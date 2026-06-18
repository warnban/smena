import { dayDiff, startOfDay } from "@/lib/format";
import { mskAddDays, mskDateKey, mskDayAfter, mskNightDiff, parseMskDateKey } from "@/lib/msk-time";
import type { Booking } from "@/lib/types";
import type { Transaction } from "@/lib/types";

type AccommodationTx = Pick<
  Transaction,
  "bookingId" | "type" | "category" | "amount" | "cancelledAt" | "paymentNights" | "paymentMethod" | "discountPercentApplied" | "discountPerNightApplied" | "discountRuleId"
>;

export function accommodationPaymentTransactions(
  bookingId: string,
  transactions?: AccommodationTx[]
): AccommodationTx[] {
  if (!transactions?.length) return [];
  return transactions.filter(
    (t) =>
      t.bookingId === bookingId &&
      t.type === "payment" &&
      t.category === "accommodation" &&
      !t.cancelledAt
  );
}

export function accommodationRefundNights(
  bookingId: string,
  transactions?: Pick<Transaction, "bookingId" | "type" | "category" | "cancelledAt">[],
  refundRecords?: { bookingId: string; nights: number }[]
): number {
  if (refundRecords?.length) {
    return refundRecords
      .filter((r) => r.bookingId === bookingId)
      .reduce((s, r) => s + r.nights, 0);
  }
  if (!transactions?.length) return 0;
  return 0;
}

/** Ночей предоплаты по транзакциям (paymentNights) или по сумме/тарифу. */
export function prepaidNightsFromTransactions(
  booking: Booking,
  transactions?: AccommodationTx[],
  refundNights = 0
): number | null {
  const payments = accommodationPaymentTransactions(booking.id, transactions);
  if (!payments.length) return null;
  const hasExplicit = payments.some((p) => p.paymentNights != null && p.paymentNights > 0);
  if (!hasExplicit) return null;
  const paidNights = payments.reduce((s, p) => s + (p.paymentNights ?? 0), 0);
  const maxNights = bookingStayNights(booking);
  return Math.min(maxNights, Math.max(0, paidNights - refundNights));
}

export function bookingStayNights(booking: Booking): number {
  return mskNightDiff(booking.checkIn, booking.checkOut);
}

export function bookingNightlyRate(booking: Booking): number {
  const nights = bookingStayNights(booking);
  return nights > 0 ? Math.round(booking.amount / nights) : 0;
}

/** Ночей, за которые гость уже «находится» в отеле (включая текущие сутки). */
export function nightsConsumedThrough(booking: Booking, dateKey = mskDateKey()): number {
  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOut = startOfDay(new Date(booking.checkOut));
  if (today < checkIn) return 0;
  if (today >= checkOut) return bookingStayNights(booking);
  return Math.max(1, dayDiff(checkIn, today) + 1);
}

/** Сумма оплат проживания: поле брони + активные транзакции (на случай рассинхрона). */
export function accommodationPaidTotal(
  booking: Pick<Booking, "id" | "paid">,
  transactions?: Pick<Transaction, "bookingId" | "type" | "category" | "amount" | "cancelledAt">[]
): number {
  if (!transactions?.length) return booking.paid;
  const fromTx = transactions
    .filter(
      (t) =>
        t.bookingId === booking.id &&
        t.type === "payment" &&
        t.category === "accommodation" &&
        !t.cancelledAt
    )
    .reduce((s, t) => s + t.amount, 0);
  return Math.max(booking.paid, fromTx);
}

export function prepaidNights(
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights = 0
): number {
  const fromTx = prepaidNightsFromTransactions(booking, transactions, refundNights);
  if (fromTx != null) return fromTx;

  const nightly = bookingNightlyRate(booking);
  const paid =
    paidOverride ??
    (transactions?.length ? accommodationPaidTotal(booking, transactions) : booking.paid);
  if (nightly <= 0 || paid <= 0) return 0;

  const exact = paid / nightly;
  const rounded = Math.round(exact);
  const maxNights = bookingStayNights(booking);

  if (rounded >= 1 && Math.abs(paid - rounded * nightly) <= Math.max(1, Math.round(nightly * 0.02))) {
    return Math.min(maxNights, rounded);
  }

  return Math.min(maxNights, Math.floor(exact));
}

/** Оплачено до 12:00 этого дня (МСК). null — если нет предоплаты. */
export function paidThroughDateKey(
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights = 0
): string | null {
  const prepaid = prepaidNights(booking, paidOverride, transactions, refundNights);
  if (prepaid <= 0) return null;
  return mskAddDays(mskDateKey(booking.checkIn), prepaid);
}

/** Первая неоплаченная ночь (дата начала суток, МСК). */
export function firstUnpaidNightDateKey(
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights = 0
): string {
  return mskAddDays(mskDateKey(booking.checkIn), prepaidNights(booking, paidOverride, transactions, refundNights));
}

/** Ночей от первой неоплаченной до даты «оплачено до» включительно. */
export function nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey: string, paidThroughKey: string): number {
  return mskNightDiff(firstUnpaidKey, mskDayAfter(paidThroughKey));
}

export function paymentDueInfo(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]) {
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const contractBooking = { ...booking, paid: effectivePaid };
  const nightly = bookingNightlyRate(contractBooking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const debtNights = isPaymentDueToday(booking, dateKey, transactions) ? Math.max(0, consumed - prepaid) : 0;
  const debt = debtNights * nightly;
  return {
    debt,
    debtNights,
    nightly,
    consumed,
    prepaidNights: prepaid,
    effectivePaid,
    firstUnpaidNightKey: firstUnpaidNightDateKey(contractBooking, undefined, transactions),
    paidThroughKey: paidThroughDateKey(contractBooking, undefined, transactions),
  };
}

/** Следующая ночь не оплачена: prepaid < consumed (но текущие сутки могут быть оплачены). */
export function isPaymentDueToday(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;

  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOutKey = mskDateKey(booking.checkOut);

  if (today < checkIn) return false;
  if (checkOutKey <= dateKey) return false;

  const totalNights = bookingStayNights(booking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  if (consumed >= totalNights) return false;

  const effectivePaid = accommodationPaidTotal(booking, transactions);
  return prepaidNights(booking, effectivePaid, transactions) < consumed;
}

export function filterPaymentDueBookings(bookings: Booking[], dateKey = mskDateKey(), transactions?: Transaction[]): Booking[] {
  return bookings.filter((b) => isPaymentDueToday(b, dateKey, transactions));
}

/** Оплачена только текущая ночь — скоро снова потребуется оплата. */
export function isPaymentDueSoon(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;
  if (isPaymentDueToday(booking, dateKey, transactions)) return false;

  const checkOutKey = mskDateKey(booking.checkOut);
  if (checkOutKey <= dateKey) return false;

  const consumed = nightsConsumedThrough(booking, dateKey);
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const prepaid = prepaidNights(booking, effectivePaid, transactions);
  const totalNights = bookingStayNights(booking);

  return prepaid === consumed && consumed < totalNights;
}

export function filterPaymentDueSoonBookings(bookings: Booking[], dateKey = mskDateKey(), transactions?: Transaction[]): Booking[] {
  return bookings.filter((b) => isPaymentDueSoon(b, dateKey, transactions));
}

export function paymentSoonInfo(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]) {
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const contractBooking = { ...booking, paid: effectivePaid };
  const nightly = bookingNightlyRate(contractBooking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const paidThrough = paidThroughDateKey(contractBooking, undefined, transactions);
  const nightsAhead = Math.max(0, prepaid - consumed);
  return { nightly, consumed, prepaidNights: prepaid, paidThroughKey: paidThrough, nightsAhead, effectivePaid };
}

export type StayReminderKind = "paymentSoon" | "checkout";

export interface StayReminder {
  booking: Booking;
  kinds: StayReminderKind[];
}

/** @deprecated Используйте StayReminderKind */
export type TomorrowReminderKind = StayReminderKind;

/** @deprecated Используйте StayReminder */
export type TomorrowReminder = StayReminder;

/** Выселение завтра (МСК). */
export function isCheckoutTomorrow(booking: Booking, todayKey = mskDateKey()): boolean {
  if (booking.status !== "checkedin") return false;
  return mskDateKey(booking.checkOut) === mskDayAfter(todayKey);
}

export function buildStayReminders(bookings: Booking[], todayKey = mskDateKey(), transactions?: Transaction[]): StayReminder[] {
  const rows: StayReminder[] = [];
  for (const booking of bookings) {
    const kinds: StayReminderKind[] = [];
    if (isPaymentDueSoon(booking, todayKey, transactions)) kinds.push("paymentSoon");
    if (isCheckoutTomorrow(booking, todayKey)) kinds.push("checkout");
    if (kinds.length) rows.push({ booking, kinds });
  }
  return rows;
}

/** @deprecated Используйте buildStayReminders */
export function buildTomorrowReminders(bookings: Booking[], todayKey = mskDateKey(), transactions?: Transaction[]): StayReminder[] {
  return buildStayReminders(bookings, todayKey, transactions);
}
