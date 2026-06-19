import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  guestUpdatePayload,
  migRegDeadlineFrom,
  validateCheckInForm,
  formDisplayName,
  type GuestFormData,
} from "@/lib/guest-form";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";
import {
  bookingStayNights,
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { setBedStatus } from "@/lib/dorm.server";
import type { CheckInPayload } from "@/lib/assistant/types";

export type PerformCheckInInput = CheckInPayload & {
  operationDate?: string;
};

export async function performCheckIn(
  session: SessionPayload,
  bookingId: string,
  input: PerformCheckInInput
): Promise<{ ok: true; amount: number; paid: number; guestId: string } | { ok: false; error: string }> {
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const booking = auth.booking;
  if (booking.status === "checkedin" || booking.status === "checkedout") {
    return { ok: false, error: "Гость уже заселён или выселен" };
  }

  if (!input.regCardSigned) {
    return { ok: false, error: "Подтвердите подписание регистрационной карточки" };
  }
  if (!input.form) {
    return { ok: false, error: "Заполните данные гостя" };
  }

  const guest = await prisma.guest.findUnique({ where: { id: booking.guestId } });
  if (!guest) return { ok: false, error: "Гость не найден" };

  const missing = validateCheckInForm({ isForeigner: guest.isForeigner }, input.form);
  if (missing.length) {
    return { ok: false, error: missing.join("; ") };
  }

  const discountRules = await prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } });
  const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);

  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(input.discountPercent) || 0)));
  const discountPerNight = Math.max(0, Math.round(Number(input.discountPerNight) || 0));
  const paymentMethod = String(input.paymentMethod ?? "cash");
  const paymentAmount = Math.round(Number(input.paymentAmount) || 0);
  const stayNights = bookingStayNights(booking);

  const existingTx = await prisma.transaction.findMany({
    where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
  });

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

  let paymentNights = Math.max(1, Math.round(Number(input.paymentNights) || stayNights));
  const paidThroughRaw = input.paidThroughDate ? String(input.paidThroughDate).slice(0, 10) : "";

  if (paidThroughRaw) {
    if (paidThroughRaw < firstUnpaidKey || paidThroughRaw > checkOutKey) {
      return { ok: false, error: "Некорректная дата «оплачено до»" };
    }
    paymentNights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
  }

  if (paymentNights < 1) {
    return { ok: false, error: "Укажите период оплаты" };
  }

  const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
  if (paymentNights > maxPayNights) {
    return { ok: false, error: "Слишком много ночей для оплаты" };
  }

  const finalAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    discountPercent: useRules ? booking.discountPercent ?? 0 : discountPercent,
    discountPerNight: useRules ? booking.discountPerNight ?? 0 : discountPerNight,
  });

  const debt = Math.max(0, finalAmount - booking.paid);
  if (!input.skipPayment && debt > 0 && paymentAmount <= 0) {
    return { ok: false, error: "Укажите сумму оплаты" };
  }

  let payNow = input.skipPayment ? 0 : Math.min(debt, paymentAmount);
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
      discountRuleId: input.discountRuleId ?? null,
      discountPercent: useRules ? 0 : discountPercent,
      discountPerNight: useRules ? 0 : discountPerNight,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.error };
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

  if (guest.isForeigner && input.migRegSubmitted) {
    migRegStatus = "submitted";
    migRegSubmittedAt = submittedAt;
    if (input.migRegNotifNumber?.trim()) notifNumber = input.migRegNotifNumber.trim();
  }

  const guestData = guestUpdatePayload(input.form, guest.isForeigner);
  const resolvedGuestName = formDisplayName(input.form) || guestData.name;

  const dateResolved = resolveTransactionDateInput(session.role, input.date ?? input.operationDate);
  if (!dateResolved.ok) {
    return { ok: false, error: dateResolved.error };
  }

  if (payNow > 0) {
    const payLock = await assertPaymentOperationAllowed(
      booking.hotelId,
      session.role,
      dateResolved.dateKey
    );
    if (!payLock.ok) {
      return { ok: false, error: payLock.error };
    }
  }

  let channelId: string | null = null;
  if (paymentMethod === OTA_PAYMENT_CODE && payNow > 0) {
    const raw = input.channelId ? String(input.channelId) : "";
    if (!raw) {
      return { ok: false, error: "Выберите канал OTA" };
    }
    const channel = await prisma.channel.findFirst({
      where: { id: raw, hotelId: booking.hotelId },
    });
    if (!channel) {
      return { ok: false, error: "Канал OTA не найден" };
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
        migRegSubmittedAt: guest.isForeigner && input.migRegSubmitted ? migRegSubmittedAt : guest.migRegSubmittedAt,
        migRegNotifNumber: guest.isForeigner && input.migRegSubmitted ? notifNumber : guest.migRegNotifNumber,
        visa: guestData.visa ? guestData.visa : Prisma.JsonNull,
        migrationCard: guestData.migrationCard ? guestData.migrationCard : Prisma.JsonNull,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "checkedin",
        guestName: resolvedGuestName,
        amount: finalAmount,
        discountPercent: useRules ? booking.discountPercent ?? 0 : discountPercent,
        discountPerNight: useRules ? booking.discountPerNight ?? 0 : discountPerNight,
        paid: booking.paid + payNow,
        ...(channelId ? { channelId } : {}),
      },
    }),
    prisma.booking.updateMany({
      where: {
        guestId: guest.id,
        id: { not: booking.id },
        status: { in: ["new", "confirmed", "checkedin"] },
      },
      data: { guestName: resolvedGuestName },
    }),
    prisma.transaction.updateMany({
      where: { bookingId: booking.id },
      data: { guestName: resolvedGuestName },
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
          date: dateResolved.date,
          bookingId: booking.id,
          guestName: resolvedGuestName,
          roomNumber: booking.room.number,
          paymentNights,
          discountRuleId: appliedRuleId,
          discountPercentApplied: appliedPct,
          discountPerNightApplied: appliedPerNight,
          note: buildAccommodationPaymentNote(bookingForNote, payNow, {
            paidBefore: booking.paid,
            extra: [`Оплачено до ${paidThroughDate} 12:00`, noteDiscount].filter(Boolean).join(". "),
            userNote: input.note ?? null,
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

  return { ok: true, amount: finalAmount, paid: booking.paid + payNow, guestId: guest.id };
}

export function formFromScanAndGuest(
  extract: Record<string, unknown>,
  guestDefaults?: Partial<GuestFormData>
): GuestFormData {
  return {
    lastName: String(extract.lastName ?? guestDefaults?.lastName ?? ""),
    firstName: String(extract.firstName ?? guestDefaults?.firstName ?? ""),
    middleName: String(extract.middleName ?? guestDefaults?.middleName ?? ""),
    gender: extract.gender === "F" ? "F" : extract.gender === "M" ? "M" : guestDefaults?.gender ?? "M",
    birthDate: String(extract.birthDate ?? guestDefaults?.birthDate ?? ""),
    birthPlace: String(extract.birthPlace ?? guestDefaults?.birthPlace ?? ""),
    phone: String(guestDefaults?.phone ?? ""),
    email: String(guestDefaults?.email ?? ""),
    country: String(extract.country ?? guestDefaults?.country ?? "Россия"),
    nationality: String(extract.nationality ?? guestDefaults?.nationality ?? "RU"),
    docType: String(extract.docType ?? guestDefaults?.docType ?? "passport_rf"),
    docSeries: String(extract.docSeries ?? guestDefaults?.docSeries ?? ""),
    docNumber: String(extract.docNumber ?? guestDefaults?.docNumber ?? ""),
    docIssuedBy: String(extract.docIssuedBy ?? guestDefaults?.docIssuedBy ?? ""),
    docIssuedDate: String(extract.docIssuedDate ?? guestDefaults?.docIssuedDate ?? ""),
    docDivisionCode: String(extract.docDivisionCode ?? guestDefaults?.docDivisionCode ?? ""),
    docExpiry: String(extract.docExpiry ?? guestDefaults?.docExpiry ?? ""),
    registrationAddress: String(extract.registrationAddress ?? guestDefaults?.registrationAddress ?? ""),
    arrivalPurpose: String(extract.arrivalPurpose ?? guestDefaults?.arrivalPurpose ?? "tourism"),
    entryDate: String(extract.entryDate ?? guestDefaults?.entryDate ?? ""),
    visa: (extract.visa as GuestFormData["visa"]) ?? guestDefaults?.visa ?? null,
    migrationCard: (extract.migrationCard as GuestFormData["migrationCard"]) ?? guestDefaults?.migrationCard ?? null,
    hasVisa: Boolean(extract.hasVisa ?? guestDefaults?.hasVisa),
    preferences: String(guestDefaults?.preferences ?? ""),
  };
}
