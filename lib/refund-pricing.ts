import { calcNightPaymentTotal, calcPaymentWithRule, matchDiscountRule, type HotelDiscountRule } from "@/lib/hotel-discount-rules";
import { bookingStayNights } from "@/lib/booking-payment-due";
import type { Booking } from "@/lib/types";

export type AccommodationPaymentSlice = {
  nights: number;
  amount: number;
  paymentMethod: string;
  discountPercent: number;
  discountPerNight: number;
  discountRuleId?: string | null;
};

export type RefundQuoteInput = {
  booking: Booking;
  roomPrice: number;
  rules: HotelDiscountRule[];
  payments: AccommodationPaymentSlice[];
  refundNights: number;
  withholdNights: number;
  consumedNights: number;
  prepaidNights: number;
};

export type RefundQuote = {
  refundAmount: number;
  maxRefundNights: number;
  recalcNote: string;
  obligationAmount: number;
  withholdAmount: number;
  clawbackAmount: number;
};

function baseNightly(roomPrice: number): number {
  return Math.max(0, Math.round(roomPrice));
}

/** Стоимость проживания за N ночей с учётом правил скидок отеля. */
export function obligationForConsumedNights(params: {
  roomPrice: number;
  consumedNights: number;
  paymentMethod: string;
  rules: HotelDiscountRule[];
  hotelId: string;
}): { amount: number; note: string } {
  const { roomPrice, consumedNights, paymentMethod, rules, hotelId } = params;
  if (consumedNights <= 0) return { amount: 0, note: "" };

  const hotelRules = rules.filter((r) => r.hotelId === hotelId && r.active);
  const rule = matchDiscountRule(hotelRules, {
    paymentNights: consumedNights,
    paymentMethod,
  });

  if (rule) {
    return {
      amount: calcPaymentWithRule(roomPrice, consumedNights, rule),
      note: `Пересчёт: ${consumedNights} ноч. со скидкой (${rule.name.trim() || "правило"})`,
    };
  }

  return {
    amount: calcNightPaymentTotal(roomPrice, consumedNights, 0, 0),
    note: consumedNights > 0 ? `Пересчёт: ${consumedNights} ноч. без скидки` : "",
  };
}

/** Доминирующий способ оплаты из платежей проживания. */
export function dominantPaymentMethod(payments: AccommodationPaymentSlice[]): string {
  if (!payments.length) return "cash";
  const totals = new Map<string, number>();
  for (const p of payments) {
    totals.set(p.paymentMethod, (totals.get(p.paymentMethod) ?? 0) + p.amount);
  }
  let best = "cash";
  let bestSum = 0;
  for (const [method, sum] of Array.from(totals.entries())) {
    if (sum > bestSum) {
      best = method;
      bestSum = sum;
    }
  }
  return best;
}

/**
 * Пересчёт возврата с учётом скидок:
 * - обязательство за прожитые ночи (возможен clawback если скидка больше не действует)
 * - удержание за позднее предупреждение (withholdNights × базовый тариф)
 * - возврат за выбранные ночи из предоплаты
 */
export function computeRefundQuote(input: RefundQuoteInput): RefundQuote {
  const {
    booking,
    roomPrice,
    rules,
    payments,
    refundNights,
    withholdNights,
    consumedNights,
    prepaidNights,
  } = input;

  const maxRefundNights = Math.max(0, prepaidNights - consumedNights - withholdNights);
  const nightsToRefund = Math.min(Math.max(0, refundNights), maxRefundNights);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0) || booking.paid;
  const paymentMethod = dominantPaymentMethod(payments);

  const { amount: obligationAmount, note: obligationNote } = obligationForConsumedNights({
    roomPrice,
    consumedNights,
    paymentMethod,
    rules,
    hotelId: booking.hotelId,
  });

  const nightlyBase = baseNightly(roomPrice);
  const withholdAmount = withholdNights * nightlyBase;

  const paidForConsumedAtBase = calcNightPaymentTotal(roomPrice, consumedNights, 0, 0);
  const paidWithDiscounts = totalPaid;

  let clawbackAmount = 0;
  let recalcParts: string[] = [];

  if (obligationAmount > paidForConsumedAtBase - (prepaidNights - consumedNights - nightsToRefund - withholdNights) * nightlyBase) {
    // Clawback: guest got discount on payment but didn't fulfill min nights for consumed period
  }

  // Максимум к возврату = оплачено − обязательство − удержание
  const maxRefundAmount = Math.max(0, totalPaid - obligationAmount - withholdAmount);

  // Запрошенный возврат по фактическим платежам (с конца предоплаты)
  let requestedRefund = 0;
  if (nightsToRefund > 0 && payments.length) {
    let remaining = nightsToRefund;
    for (let i = payments.length - 1; i >= 0 && remaining > 0; i--) {
      const p = payments[i];
      const take = Math.min(remaining, p.nights);
      const sliceAmount = p.nights > 0 ? Math.round((p.amount / p.nights) * take) : 0;
      requestedRefund += sliceAmount;
      remaining -= take;
    }
  } else if (nightsToRefund > 0) {
    const stayNights = bookingStayNights(booking);
    const avgNightly = stayNights > 0 ? Math.round(booking.amount / stayNights) : nightlyBase;
    requestedRefund = nightsToRefund * avgNightly;
  }

  const refundAmount = Math.min(requestedRefund, maxRefundAmount);

  if (obligationNote) recalcParts.push(obligationNote);
  if (withholdNights > 0) {
    recalcParts.push(`Удержано ${withholdNights} ноч. (${withholdAmount} ₽)`);
  }
  if (refundAmount < requestedRefund && requestedRefund > 0) {
    clawbackAmount = requestedRefund - refundAmount;
    recalcParts.push(`Корректировка скидки: −${clawbackAmount} ₽`);
  }

  return {
    refundAmount: Math.max(0, Math.round(refundAmount)),
    maxRefundNights,
    recalcNote: recalcParts.join(". "),
    obligationAmount,
    withholdAmount,
    clawbackAmount,
  };
}
