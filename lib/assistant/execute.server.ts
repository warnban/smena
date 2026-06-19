import "server-only";

import { prisma } from "@/lib/prisma";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { assertHotelWrite } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { calcStayAmount } from "@/lib/booking-pricing";
import { guestGenderMatchesDorm, formatBedDisplay, formatDormPlaceLabel } from "@/lib/dorm.server";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import {
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff, mskDayAfter, parseMskDateKey } from "@/lib/msk-time";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import {
  buildRefundQuoteFromContext,
  canRefundBooking,
  loadRefundContext,
} from "@/lib/booking-refund";
import { buildAccommodationRefundNote } from "@/lib/booking-transaction-notes";
import type { PendingAction } from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";
import {
  executeBookingService,
  executeCancelBooking,
  executeCheckIn,
  executeCheckout,
  executeEncashment,
  executeHkComplete,
  executeMigReg,
  executeRelocate,
  executeSale,
} from "@/lib/assistant/execute-hamster.server";

export async function executePendingAction(
  session: SessionPayload,
  action: PendingAction,
  opts: { paymentMethod?: string; channelId?: string }
): Promise<{ ok: true; message: string; guestId?: string; bookingId?: string; printLinks?: Array<{ label: string; url: string }> } | { ok: false; error: string }> {
  switch (action.type) {
    case "record_payment":
      return executeRecordPayment(session, action.payload, opts);
    case "extend_stay":
      return executeExtendStay(session, action.payload);
    case "process_refund":
      return executeRefund(session, action.payload, opts);
    case "create_booking":
      return executeCreateBooking(session, action.payload);
    case "checkin":
      return executeCheckIn(session, action.payload, opts);
    case "checkout":
      return executeCheckout(session, action.payload);
    case "relocate":
      return executeRelocate(session, action.payload);
    case "sale":
      return executeSale(session, action.payload, opts);
    case "encashment":
      return executeEncashment(session, action.payload, opts);
    case "cancel_booking":
      return executeCancelBooking(session, action.payload);
    case "booking_service":
      return executeBookingService(session, action.payload, opts);
    case "mig_reg":
      return executeMigReg(session, action.payload);
    case "hk_complete":
      return executeHkComplete(session, action.payload);
    default:
      return { ok: false, error: "Неизвестная операция" };
  }
}

async function executeRecordPayment(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string; channelId?: string }
) {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const booking = auth.booking;
  const payLock = await assertPaymentsOpen(booking.hotelId);
  if (!payLock.ok) return { ok: false as const, error: payLock.error };

  const nights = Math.max(1, Math.round(Number(payload.nights) || 1));
  const paidThroughRaw = payload.paidThroughDate ? String(payload.paidThroughDate).slice(0, 10) : "";
  const paymentMethod = String(opts.paymentMethod ?? "cash");
  const amount = Math.round(Number(payload.amount) || 0);
  const note = String(payload.note ?? "").trim();

  if (!amount || amount <= 0) {
    return { ok: false as const, error: "Некорректная сумма" };
  }

  const [discountRules, existingTx] = await Promise.all([
    prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } }),
    prisma.transaction.findMany({
      where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
    }),
  ]);

  const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);
  const contractAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    discountPercent: booking.discountPercent ?? 0,
    discountPerNight: booking.discountPerNight ?? 0,
  });

  const pricingBooking = { ...booking, amount: useRules ? booking.amount || contractAmount : contractAmount };
  const firstUnpaidKey = firstUnpaidNightDateKey(pricingBooking, undefined, existingTx);
  const checkOutKey = mskDateKey(booking.checkOut);

  let payNights = nights;
  if (paidThroughRaw) {
    if (paidThroughRaw < firstUnpaidKey || paidThroughRaw > checkOutKey) {
      return { ok: false as const, error: "Некорректная дата «оплачено до»" };
    }
    payNights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
  }

  const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
  if (payNights > maxPayNights) {
    return { ok: false as const, error: "Слишком много ночей для оплаты" };
  }

  const validation = validatePaymentDiscount({
    rules: discountRules,
    hotelId: booking.hotelId,
    roomPrice: booking.room.price,
    paymentNights: payNights,
    paymentMethod,
    amount,
      discountRuleId: null,
    discountPercent: useRules ? 0 : booking.discountPercent ?? 0,
    discountPerNight: useRules ? 0 : booking.discountPerNight ?? 0,
  });

  if (!validation.ok) {
    return { ok: false as const, error: validation.error };
  }

  let channelId: string | null = null;
  if (paymentMethod === OTA_PAYMENT_CODE) {
    const raw = opts.channelId ? String(opts.channelId) : "";
    if (!raw) return { ok: false as const, error: "Выберите канал OTA" };
    const channel = await prisma.channel.findFirst({
      where: { id: raw, hotelId: booking.hotelId },
    });
    if (!channel) return { ok: false as const, error: "Канал OTA не найден" };
    channelId = channel.id;
  }

  const paidThroughDate = paidThroughRaw || mskAddDays(firstUnpaidKey, payNights - 1);
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

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        hotelId: booking.hotelId,
        type: "payment",
        category: "accommodation",
        paymentMethod,
        amount: validation.expectedAmount,
        bookingId: booking.id,
        guestName: booking.guestName,
        roomNumber: booking.room.number,
        paymentNights: payNights,
        discountRuleId: appliedRule?.id ?? null,
        discountPercentApplied: validation.discountPercent,
        discountPerNightApplied: validation.discountPerNight,
        note: buildAccommodationPaymentNote(bookingForNote, validation.expectedAmount, {
          paidBefore: booking.paid,
          extra: [`Оплачено до ${paidThroughDate} 12:00`, noteDiscount].filter(Boolean).join(". "),
          userNote: note || null,
        }),
        ...(channelId ? { channelId } : {}),
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        paid: booking.paid + validation.expectedAmount,
        ...(channelId ? { channelId } : {}),
      },
    }),
  ]);

  return {
    ok: true as const,
    message: `Оплата ${validation.expectedAmount} ₽ проведена. ${booking.guestName}, оплачено до ${paidThroughDate} 12:00.`,
  };
}

async function executeExtendStay(session: SessionPayload, payload: Record<string, unknown>) {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const booking = auth.booking;
  if (booking.status === "cancelled" || booking.status === "checkedout") {
    return { ok: false as const, error: "Нельзя изменить срок этой брони" };
  }

  const newCheckOutKey = String(payload.checkOut ?? "").slice(0, 10);
  if (!newCheckOutKey) {
    return { ok: false as const, error: "Не указана дата выезда" };
  }

  const checkInKey = mskDateKey(booking.checkIn);
  const prevCheckOutKey = mskDateKey(booking.checkOut);
  const minCheckOutKey = mskDayAfter(checkInKey);

  if (newCheckOutKey < minCheckOutKey) {
    return { ok: false as const, error: "Дата выезда должна быть позже даты заезда" };
  }
  if (newCheckOutKey === prevCheckOutKey) {
    return { ok: false as const, error: "Выберите другую дату выезда" };
  }

  const newCheckOut = parseMskDateKey(newCheckOutKey);
  const newAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: newCheckOut,
    discountPercent: booking.discountPercent,
    discountPerNight: booking.discountPerNight,
  });

  const nightDelta = mskNightDiff(booking.checkIn, newCheckOutKey) - mskNightDiff(booking.checkIn, prevCheckOutKey);
  const amountDelta = newAmount - booking.amount;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { checkOut: newCheckOut, amount: newAmount },
    }),
    prisma.stayAmendment.create({
      data: {
        bookingId: booking.id,
        prevCheckOut: booking.checkOut,
        prevAmount: booking.amount,
        prevNights: mskNightDiff(booking.checkIn, prevCheckOutKey),
        newCheckOut,
        newAmount,
        nightDelta,
        amountDelta,
      },
    }),
  ]);

  return {
    ok: true as const,
    message: `Срок проживания ${booking.guestName} изменён: выезд ${newCheckOutKey} (${amountDelta >= 0 ? "+" : ""}${amountDelta} ₽).`,
  };
}

async function executeRefund(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string; channelId?: string }
) {
  const hotelId = String(payload.hotelId ?? "");
  const bookingId = String(payload.bookingId ?? "");
  const nights = Math.round(Number(payload.nights) || 0);
  const withholdNights = Math.max(0, Math.min(1, Math.round(Number(payload.withholdNights) || 0)));
  const paymentMethod = String(opts.paymentMethod ?? "cash");
  const note = String(payload.note ?? "").trim();

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) return { ok: false as const, error: payLock.error };

  const ctx = await loadRefundContext(bookingId, hotelId, session.seatId!);
  if (!ctx) return { ok: false as const, error: "Бронь не найдена" };

  if (!canRefundBooking(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal)) {
    return { ok: false as const, error: "Нет доступных ночей для возврата" };
  }

  const quote = buildRefundQuoteFromContext(ctx, nights, withholdNights);
  if (nights > quote.maxRefundNights) {
    return { ok: false as const, error: `Можно вернуть не более ${quote.maxRefundNights} ноч.` };
  }

  const amount = quote.refundAmount;
  if (amount <= 0 || amount > ctx.booking.paid) {
    return { ok: false as const, error: "Некорректная сумма возврата" };
  }

  let refundNote = buildAccommodationRefundNote(ctx.booking, nights, note || null);
  if (quote.recalcNote) refundNote = `${refundNote}. ${quote.recalcNote}`;
  if (withholdNights > 0) refundNote = `${refundNote}. Удержание ${withholdNights} ноч.`;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        hotelId,
        bookingId: ctx.booking.id,
        type: "refund",
        category: "accommodation",
        paymentMethod,
        amount,
        guestName: ctx.booking.guestName,
        roomNumber: ctx.roomNumber,
        note: refundNote,
      },
    });

    await tx.booking.update({
      where: { id: ctx.booking.id },
      data: { paid: Math.max(0, ctx.booking.paid - amount) },
    });

    await tx.refundRecord.create({
      data: {
        hotelId,
        bookingId: ctx.booking.id,
        transactionId: transaction.id,
        guestName: ctx.booking.guestName,
        nights,
        amount,
        paymentMethod,
        note: refundNote,
        withholdNights,
        recalcNote: quote.recalcNote,
      },
    });
  });

  return {
    ok: true as const,
    message: `Возврат ${amount} ₽ за ${nights} ноч. проведён (${ctx.booking.guestName}).`,
  };
}

async function executeCreateBooking(session: SessionPayload, payload: Record<string, unknown>) {
  const hotelId = String(payload.hotelId ?? "");
  const roomId = String(payload.roomId ?? "");
  const guestName = String(payload.guestName ?? "").trim();
  const guestId = payload.guestId ? String(payload.guestId) : "";
  const checkIn = String(payload.checkIn).slice(0, 10);
  const checkOut = String(payload.checkOut).slice(0, 10);
  const phone = String(payload.phone ?? "").trim();
  const isForeigner = Boolean(payload.isForeigner);

  const bedIdRaw = payload.bedId ? String(payload.bedId) : null;

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
  if (!room) return { ok: false as const, error: "Номер не найден" };

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (checkOutDate <= checkInDate) {
    return { ok: false as const, error: "Дата выезда должна быть позже заезда" };
  }

  let guest;
  if (guestId) {
    guest = await prisma.guest.findFirst({
      where: { id: guestId, seatId: session.seatId! },
    });
    if (!guest) return { ok: false as const, error: "Гость не найден" };
    guest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        visits: { increment: 1 },
        ...(phone ? { phone } : {}),
      },
    });
  } else {
    if (!guestName) return { ok: false as const, error: "Укажите ФИО гостя" };
    const nameParts = guestName.split(/\s+/);
    guest = await prisma.guest.create({
      data: {
        seatId: session.seatId!,
        name: guestName,
        lastName: nameParts[0] ?? "",
        firstName: nameParts[1] ?? "",
        middleName: nameParts.slice(2).join(" "),
        phone,
        isForeigner,
        country: isForeigner ? "" : "Россия",
        nationality: isForeigner ? "" : "RU",
        migRegRequired: isForeigner,
        migRegStatus: isForeigner ? "pending" : "not_required",
        visits: 1,
      },
    });
  }

  let bedId: string | null = bedIdRaw;
  const checkInKey = mskDateKey(checkInDate);
  const checkOutKey = mskDateKey(checkOutDate);

  if (room.kind === "dorm") {
    if (!guestGenderMatchesDorm(guest.gender, room.dormGender)) {
      return { ok: false as const, error: "Пол гостя не подходит для общей комнаты" };
    }
    const available = await findAvailableRooms({
      hotelId,
      checkIn: checkInKey,
      checkOut: checkOutKey,
      guestGender: guest.gender,
      kind: "dorm",
      limit: 100,
    });
    if (!bedId) {
      const auto = available.rooms.find((s) => s.roomId === roomId);
      if (!auto?.bedId) return { ok: false as const, error: "Нет свободных койко-мест" };
      bedId = auto.bedId;
    } else if (!available.rooms.some((s) => s.bedId === bedId)) {
      return { ok: false as const, error: "Койко-место недоступно" };
    }
  } else if (bedId) {
    return { ok: false as const, error: "Койко-место только для общих комнат" };
  }

  const amount = payload.amount
    ? Math.round(Number(payload.amount))
    : calcStayAmount({ roomPrice: room.price, checkIn: checkInDate, checkOut: checkOutDate });

  const booking = await prisma.booking.create({
    data: {
      hotelId,
      roomId,
      bedId,
      guestId: guest.id,
      guestName: guest.name,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      source: "direct",
      status: "new",
      amount,
      guests: 1,
      paid: 0,
    },
  });

  const bed = bedId ? await prisma.bed.findUnique({ where: { id: bedId } }) : null;
  const place = bed && room.kind === "dorm"
    ? formatDormPlaceLabel(room.number, bed.label)
    : bed
      ? formatBedDisplay(bed.label)
      : room.number;

  return {
    ok: true as const,
    message: `Бронь создана: ${guest.name}, №${place}, ${checkIn} — ${checkOut}.`,
  };
}
