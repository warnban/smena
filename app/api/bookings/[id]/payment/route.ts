import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { apiErrorMessage } from "@/lib/api-error";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  bookingStayNights,
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertBookingWrite(await getSession(), params.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const booking = auth.booking;
    const body = await req.json();
    const session = auth.session;

    const dateResolved = resolveTransactionDateInput(session.role, body.date ?? body.operationDate);
    if (!dateResolved.ok) {
      return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
    }

    const payLock = await assertPaymentOperationAllowed(
      booking.hotelId,
      session.role,
      dateResolved.dateKey
    );
    if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

    const [discountRules, existingTx] = await Promise.all([
      prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } }),
      prisma.transaction.findMany({
        where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
      }),
    ]);

    const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);
    const discountPercent = Math.max(0, Math.min(100, Math.round(Number(body.discountPercent) || booking.discountPercent || 0)));
    const discountPerNight = Math.max(0, Math.round(Number(body.discountPerNight) || booking.discountPerNight || 0));

    const stayNights = bookingStayNights(booking);
    const contractAmount = useRules
      ? calcStayAmount({
          roomPrice: booking.room.price,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          discountPercent: booking.discountPercent ?? 0,
          discountPerNight: booking.discountPerNight ?? 0,
        })
      : calcStayAmount({
          roomPrice: booking.room.price,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          discountPercent,
          discountPerNight,
        });

    const pricingBooking = { ...booking, amount: useRules ? booking.amount || contractAmount : contractAmount };
    const firstUnpaidKey = firstUnpaidNightDateKey(pricingBooking, undefined, existingTx);
    const checkOutKey = mskDateKey(booking.checkOut);

    let nights = Math.max(1, Math.round(Number(body.nights) || 0));
    const paidThroughRaw = body.paidThroughDate ? String(body.paidThroughDate).slice(0, 10) : "";

    if (paidThroughRaw) {
      if (paidThroughRaw < firstUnpaidKey || paidThroughRaw > checkOutKey) {
        return NextResponse.json({ error: "Некорректная дата «оплачено до»" }, { status: 400 });
      }
      nights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
    }

    if (nights < 1) {
      return NextResponse.json({ error: "Укажите период оплаты" }, { status: 400 });
    }

    const prepaid = prepaidNights(pricingBooking, undefined, existingTx);
    const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
    if (nights > maxPayNights) {
      return NextResponse.json({ error: "Слишком много ночей для оплаты" }, { status: 400 });
    }

    const paymentMethod = String(body.paymentMethod ?? "cash");
    const amount = body.amount != null ? Math.round(Number(body.amount)) : 0;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    const validation = validatePaymentDiscount({
      rules: discountRules,
      hotelId: booking.hotelId,
      roomPrice: booking.room.price,
      paymentNights: nights,
      paymentMethod,
      amount,
      discountRuleId: body.discountRuleId ?? null,
      discountPercent: useRules ? 0 : discountPercent,
      discountPerNight: useRules ? 0 : discountPerNight,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let channelId: string | null = null;
    if (paymentMethod === OTA_PAYMENT_CODE) {
      const raw = body.channelId ? String(body.channelId) : "";
      if (!raw) {
        return NextResponse.json({ error: "Выберите канал OTA" }, { status: 400 });
      }
      const channel = await prisma.channel.findFirst({
        where: { id: raw, hotelId: booking.hotelId },
      });
      if (!channel) {
        return NextResponse.json({ error: "Канал OTA не найден" }, { status: 400 });
      }
      channelId = channel.id;
    }

    const paidThroughDate = paidThroughRaw || mskAddDays(firstUnpaidKey, nights - 1);
    const discountChanged =
      !useRules &&
      (discountPercent !== (booking.discountPercent ?? 0) || discountPerNight !== (booking.discountPerNight ?? 0));
    const amountChanged = !useRules && contractAmount !== booking.amount;

    const appliedRule = validation.rule;
    const noteDiscount = appliedRule
      ? `Скидка: ${formatRuleLabel(appliedRule)}`
      : !useRules && (validation.discountPercent || validation.discountPerNight)
        ? "Со скидкой"
        : null;

    const bookingForNote = {
      ...booking,
      amount: useRules ? booking.amount : contractAmount,
      discountPercent: useRules ? booking.discountPercent ?? 0 : validation.discountPercent,
      discountPerNight: useRules ? booking.discountPerNight ?? 0 : validation.discountPerNight,
    };

    const [, updated] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          hotelId: booking.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod,
          amount: validation.expectedAmount,
          date: dateResolved.date,
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
          paymentNights: nights,
          discountRuleId: appliedRule?.id ?? null,
          discountPercentApplied: validation.discountPercent,
          discountPerNightApplied: validation.discountPerNight,
          note: buildAccommodationPaymentNote(bookingForNote, validation.expectedAmount, {
            paidBefore: booking.paid,
            extra: [`Оплачено до ${paidThroughDate} 12:00`, noteDiscount].filter(Boolean).join(". "),
            userNote: body.note ?? null,
          }),
          ...(channelId ? { channelId } : {}),
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paid: booking.paid + validation.expectedAmount,
          ...(amountChanged || discountChanged
            ? {
                amount: contractAmount,
                discountPercent: validation.discountPercent,
                discountPerNight: validation.discountPerNight,
              }
            : {}),
          ...(channelId ? { channelId } : {}),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, booking: updated });
  } catch (e) {
    console.error("[payment]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось принять платёж") }, { status: 500 });
  }
}
