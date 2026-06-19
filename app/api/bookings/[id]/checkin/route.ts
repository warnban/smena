import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  guestUpdatePayload,
  migRegDeadlineFrom,
  validateCheckInForm,
} from "@/lib/guest-form";
import type { GuestFormData } from "@/lib/guest-form";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { apiErrorMessage } from "@/lib/api-error";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";
import {
  bookingStayNights,
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { setBedStatus } from "@/lib/dorm.server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { guest: true, hotel: true, room: true },
  });
  if (!booking || booking.hotel.seatId !== session.seatId) {
    return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
  }
  if (booking.status === "checkedin" || booking.status === "checkedout") {
    return NextResponse.json({ error: "Гость уже заселён или выселен" }, { status: 400 });
  }

  const body = await req.json();
  const { form, regCardSigned, migRegSubmitted, migRegNotifNumber } = body as {
    form?: GuestFormData;
    regCardSigned?: boolean;
    migRegSubmitted?: boolean;
    migRegNotifNumber?: string;
    paymentMethod?: string;
    paymentAmount?: number;
    paymentNights?: number;
    paidThroughDate?: string;
    note?: string;
    discountPercent?: number;
    discountPerNight?: number;
    discountRuleId?: string;
    skipPayment?: boolean;
    channelId?: string;
  };

  if (!regCardSigned) {
    return NextResponse.json({ error: "Подтвердите подписание регистрационной карточки" }, { status: 400 });
  }
  if (!form) {
    return NextResponse.json({ error: "Заполните данные гостя" }, { status: 400 });
  }

  const guest = booking.guest;
  const missing = validateCheckInForm({ isForeigner: guest.isForeigner }, form);
  if (missing.length) {
    return NextResponse.json({ error: missing.join("; "), missing }, { status: 400 });
  }

  const discountRules = await prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } });
  const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);

  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(body.discountPercent) || 0)));
  const discountPerNight = Math.max(0, Math.round(Number(body.discountPerNight) || 0));
  const paymentMethod = String(body.paymentMethod ?? "cash");
  const paymentAmount = Math.round(Number(body.paymentAmount) || 0);
  const stayNights = bookingStayNights(booking);

  const [existingTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
    }),
  ]);

  const pricingBooking = {
    ...booking,
    amount: calcStayAmount({
      roomPrice: booking.room.price,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      discountPercent: useRules ? booking.discountPercent ?? 0 : discountPercent,
      discountPerNight: useRules ? booking.discountPerNight ?? 0 : discountPerNight,
    }),
  };

  const firstUnpaidKey = firstUnpaidNightDateKey(pricingBooking, undefined, existingTx);
  const checkOutKey = mskDateKey(booking.checkOut);

  let paymentNights = Math.max(1, Math.round(Number(body.paymentNights) || stayNights));
  const paidThroughRaw = body.paidThroughDate ? String(body.paidThroughDate).slice(0, 10) : "";

  if (paidThroughRaw) {
    if (paidThroughRaw < firstUnpaidKey || paidThroughRaw > checkOutKey) {
      return NextResponse.json({ error: "Некорректная дата «оплачено до»" }, { status: 400 });
    }
    paymentNights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
  }

  if (paymentNights < 1) {
    return NextResponse.json({ error: "Укажите период оплаты" }, { status: 400 });
  }

  const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
  if (paymentNights > maxPayNights) {
    return NextResponse.json({ error: "Слишком много ночей для оплаты" }, { status: 400 });
  }

  const finalAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    discountPercent: useRules ? booking.discountPercent ?? 0 : discountPercent,
    discountPerNight: useRules ? booking.discountPerNight ?? 0 : discountPerNight,
  });

  const debt = Math.max(0, finalAmount - booking.paid);
  if (!body.skipPayment && debt > 0 && paymentAmount <= 0) {
    return NextResponse.json({ error: "Укажите сумму оплаты" }, { status: 400 });
  }

  let payNow = body.skipPayment ? 0 : Math.min(debt, paymentAmount);
  let appliedRuleId: string | null = null;
  let appliedPct = 0;
  let appliedPerNight = 0;

  if (payNow > 0) {
    const validation = validatePaymentDiscount({
      rules: discountRules,
      hotelId: booking.hotelId,
      roomPrice: booking.room.price,
      paymentNights,
      paymentMethod,
      amount: payNow,
      discountRuleId: body.discountRuleId ?? null,
      discountPercent: useRules ? 0 : discountPercent,
      discountPerNight: useRules ? 0 : discountPerNight,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    payNow = validation.expectedAmount;
    appliedRuleId = validation.rule?.id ?? null;
    appliedPct = validation.discountPercent;
    appliedPerNight = validation.discountPerNight;
  }

  const now = new Date();
  const submittedAt = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const migRegDeadline =
    guest.migRegDeadline || (guest.isForeigner ? migRegDeadlineFrom(booking.checkIn) : "");

  let migRegStatus = guest.migRegStatus;
  let migRegSubmittedAt = guest.migRegSubmittedAt;
  let notifNumber = guest.migRegNotifNumber;

  if (guest.isForeigner && migRegSubmitted) {
    migRegStatus = "submitted";
    migRegSubmittedAt = submittedAt;
    if (migRegNotifNumber?.trim()) notifNumber = migRegNotifNumber.trim();
  }

  const guestData = guestUpdatePayload(form, guest.isForeigner);

  if (payNow > 0) {
    const payLock = await assertPaymentsOpen(booking.hotelId);
    if (!payLock.ok) {
      return NextResponse.json({ error: payLock.error }, { status: payLock.status });
    }
  }

  let channelId: string | null = null;
  if (paymentMethod === OTA_PAYMENT_CODE && payNow > 0) {
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

  const paidThroughDate = paidThroughRaw || mskAddDays(firstUnpaidKey, paymentNights - 1);

  const appliedRule = appliedRuleId ? discountRules.find((r) => r.id === appliedRuleId) : null;
  const noteDiscount = appliedRule
    ? `Скидка: ${formatRuleLabel(appliedRule)}`
    : !useRules && (appliedPct || appliedPerNight)
      ? "Заселение со скидкой"
      : null;

  const bookingForNote = {
    ...booking,
    amount: finalAmount,
    discountPercent: useRules ? booking.discountPercent ?? 0 : appliedPct,
    discountPerNight: useRules ? booking.discountPerNight ?? 0 : appliedPerNight,
  };

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.guest.update({
      where: { id: guest.id },
      data: {
        ...guestData,
        regCardSigned: true,
        migRegRequired: guest.isForeigner,
        migRegDeadline,
        migRegStatus: guest.isForeigner ? migRegStatus : "not_required",
        migRegSubmittedAt: guest.isForeigner && migRegSubmitted ? migRegSubmittedAt : guest.migRegSubmittedAt,
        migRegNotifNumber: guest.isForeigner && migRegSubmitted ? notifNumber : guest.migRegNotifNumber,
        visa: guestData.visa ? guestData.visa : Prisma.JsonNull,
        migrationCard: guestData.migrationCard ? guestData.migrationCard : Prisma.JsonNull,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "checkedin",
        amount: finalAmount,
        discountPercent: useRules ? booking.discountPercent ?? 0 : discountPercent,
        discountPerNight: useRules ? booking.discountPerNight ?? 0 : discountPerNight,
        paid: booking.paid + payNow,
        ...(channelId ? { channelId } : {}),
      },
    }),
    ...(booking.bedId
      ? []
      : [prisma.room.update({ where: { id: booking.roomId }, data: { status: "occupied" } })]),
  ];

  if (payNow > 0) {
    ops.push(
      prisma.transaction.create({
        data: {
          hotelId: booking.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod,
          amount: payNow,
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
          paymentNights,
          discountRuleId: appliedRuleId,
          discountPercentApplied: appliedPct,
          discountPerNightApplied: appliedPerNight,
          note: buildAccommodationPaymentNote(bookingForNote, payNow, {
            paidBefore: booking.paid,
            extra: [`Оплачено до ${paidThroughDate} 12:00`, noteDiscount].filter(Boolean).join(". "),
            userNote: body.note ?? null,
          }),
          ...(channelId ? { channelId } : {}),
        },
      })
    );
  }

  await prisma.$transaction(ops);
  if (booking.bedId) {
    await setBedStatus(booking.bedId, "occupied");
  }
  return NextResponse.json({ ok: true, amount: finalAmount, paid: booking.paid + payNow });
  } catch (e) {
    console.error("[checkin]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось заселить гостя") }, { status: 500 });
  }
}
