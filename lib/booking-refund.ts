import { prisma } from "@/lib/prisma";
import {
  accommodationPaymentTransactions,
  accommodationPaidTotal,
  bookingNightlyRate,
  nightsConsumedThrough,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { calcNightPaymentTotal } from "@/lib/hotel-discount-rules";
import type { HotelDiscountRule } from "@/lib/hotel-discount-rules";
import { computeRefundQuote, type AccommodationPaymentSlice } from "@/lib/refund-pricing";
import type { Booking } from "@/lib/types";

export function refundableNights(
  booking: Booking,
  dateKey?: string,
  transactions?: Parameters<typeof prepaidNights>[2],
  refundNights = 0
): number {
  const prepaid = prepaidNights(booking, undefined, transactions, refundNights);
  const consumed = nightsConsumedThrough(booking, dateKey);
  return Math.max(0, prepaid - consumed);
}

export function refundAmountForNights(booking: Booking, nights: number): number {
  return nights * bookingNightlyRate(booking);
}

export function canRefundBooking(
  booking: Booking,
  dateKey?: string,
  transactions?: Parameters<typeof prepaidNights>[2],
  refundNights = 0
): boolean {
  if (booking.status !== "checkedin" && booking.status !== "checkedout" && booking.status !== "confirmed") {
    return false;
  }
  if (accommodationPaidTotal(booking, transactions) <= 0) return false;
  return refundableNights(booking, dateKey, transactions, refundNights) > 0;
}

export async function loadRefundContext(bookingId: string, hotelId: string, seatId: string) {
  const [booking, rules, transactions, refundRecords] = await Promise.all([
    prisma.booking.findFirst({
      where: { id: bookingId, hotelId, hotel: { seatId } },
      include: { room: true },
    }),
    prisma.hotelDiscountRule.findMany({
      where: { hotelId, active: true },
      orderBy: [{ minNights: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { bookingId, category: "accommodation", cancelledAt: null },
      orderBy: { date: "asc" },
    }),
    prisma.refundRecord.findMany({
      where: { bookingId },
      select: { nights: true, bookingId: true },
    }),
  ]);

  if (!booking) return null;

  const refundNightsTotal = refundRecords.reduce((s, r) => s + r.nights, 0);
  const roomPrice = booking.room.price;
  const payments: AccommodationPaymentSlice[] = accommodationPaymentTransactions(bookingId, transactions).map((t) => {
    const discountPercent = t.discountPercentApplied ?? 0;
    const discountPerNight = t.discountPerNightApplied ?? 0;
    let nights = t.paymentNights ?? 0;
    if (nights <= 0 && t.amount > 0) {
      const sampleNightly = Math.max(1, calcNightPaymentTotal(roomPrice, 1, discountPercent, discountPerNight));
      nights = Math.max(1, Math.round(t.amount / sampleNightly));
    }
    return {
      nights,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      discountPercent,
      discountPerNight,
      discountRuleId: t.discountRuleId,
    };
  });

  const bookingDto = {
    ...booking,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  };

    return {
      booking: bookingDto,
      roomPrice,
      roomNumber: booking.room.number,
      rules: rules as HotelDiscountRule[],
    payments,
    refundNightsTotal,
    transactions,
  };
}

export function buildRefundQuoteFromContext(
  ctx: NonNullable<Awaited<ReturnType<typeof loadRefundContext>>>,
  refundNights: number,
  withholdNights: number
) {
  const consumed = nightsConsumedThrough(ctx.booking);
  const prepaid = prepaidNights(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal);

  return computeRefundQuote({
    booking: ctx.booking,
    roomPrice: ctx.roomPrice,
    rules: ctx.rules,
    payments: ctx.payments,
    refundNights,
    withholdNights,
    consumedNights: consumed,
    prepaidNights: prepaid,
  });
}
