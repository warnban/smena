import { fmtDateRu, startOfDay } from "@/lib/format";
import { bookingNightlyRate, bookingStayNights } from "@/lib/booking-payment-due";
import type { Booking } from "@/lib/types";

type BookingLike = Pick<Booking, "checkIn" | "checkOut" | "amount" | "paid">;

function dateForNight(checkIn: Date | string, nightIndex: number): Date {
  const d = startOfDay(new Date(checkIn));
  d.setDate(d.getDate() + nightIndex - 1);
  return d;
}

export function formatStayNightPeriod(checkIn: Date | string, fromNight: number, toNight: number): string {
  const start = dateForNight(checkIn, fromNight);
  const end = dateForNight(checkIn, toNight);
  const a = fmtDateRu(start);
  const b = fmtDateRu(end);
  return a === b ? a : `${a} — ${b}`;
}

function nightsInAmount(amount: number, nightly: number): number {
  if (nightly <= 0) return 1;
  return Math.max(1, Math.round(amount / nightly));
}

export function buildAccommodationPaymentNote(
  booking: BookingLike,
  amount: number,
  options?: { paidBefore?: number; extra?: string | null; userNote?: string | null }
): string {
  const paidBefore = options?.paidBefore ?? booking.paid;
  const nightly = bookingNightlyRate({ ...booking, paid: paidBefore } as Booking);
  const totalNights = bookingStayNights(booking as Booking);
  const count = nightsInAmount(amount, nightly);
  const startNight = nightly > 0 ? Math.floor(paidBefore / nightly) + 1 : 1;
  const endNight = Math.min(startNight + count - 1, totalNights);
  const period = formatStayNightPeriod(booking.checkIn, startNight, endNight);

  const parts = [`Оплата проживания за ${period}`];
  if (options?.extra?.trim()) parts.push(options.extra.trim());
  if (options?.userNote?.trim()) parts.push(options.userNote.trim());

  return parts.join(". ");
}

export function buildAccommodationRefundNote(
  booking: BookingLike,
  nightsToRefund: number,
  userNote?: string | null
): string {
  const nightly = bookingNightlyRate(booking as Booking);
  const prepaid = nightly > 0 ? Math.floor(booking.paid / nightly) : 0;
  const startNight = Math.max(1, prepaid - nightsToRefund + 1);
  const endNight = prepaid;
  const period = formatStayNightPeriod(booking.checkIn, startNight, endNight);

  let note = `Возврат за проживание ${period}`;
  if (userNote?.trim()) note += `. ${userNote.trim()}`;
  return note;
}
