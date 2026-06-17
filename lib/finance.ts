import type { Booking, Transaction } from "@/lib/types";
import type { PaymentMethodDef } from "@/lib/payment-methods";
import { pmCodes } from "@/lib/payment-methods";
import { mskDateKey } from "@/lib/msk-time";

export const OTA_PAYMENT_CODE = "ota";
const ACCOMMODATION = "accommodation";

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** OTA-оплата за проживание учитывается в отчётах только после выезда. */
export function isTransactionCancelled(t: Pick<Transaction, "cancelledAt">): boolean {
  return Boolean(t.cancelledAt);
}

export function isOtaAccommodation(t: Transaction): boolean {
  return t.paymentMethod === OTA_PAYMENT_CODE && t.category === ACCOMMODATION;
}

export function isTransactionRecognized(t: Transaction, bookings: Booking[]): boolean {
  if (isTransactionCancelled(t)) return false;
  if (!isOtaAccommodation(t) || !t.bookingId) return true;
  const b = bookings.find((x) => x.id === t.bookingId);
  return b?.status === "checkedout";
}

/** Дата учёта в финансовых отчётах (для OTA проживания — дата выезда). */
export function transactionReportDate(t: Transaction, bookings: Booking[]): Date {
  if (isOtaAccommodation(t) && t.bookingId) {
    const b = bookings.find((x) => x.id === t.bookingId);
    if (b?.checkedOutAt) return new Date(b.checkedOutAt);
    if (b?.checkOut) return startOfDay(new Date(b.checkOut));
  }
  return t.date;
}

export function transactionOnReportDay(
  t: Transaction,
  bookings: Booking[],
  date: Date
): boolean {
  if (!isTransactionRecognized(t, bookings)) return false;
  return sameDay(transactionReportDate(t, bookings), date);
}

/** Учёт транзакции в дневном отчёте по дате признания (МСК). */
export function transactionOnReportMskDay(
  t: Transaction,
  bookings: Booking[],
  dateKey: string
): boolean {
  if (!isTransactionRecognized(t, bookings)) return false;
  return mskDateKey(transactionReportDate(t, bookings)) === dateKey;
}

/** Накопительный учёт до конца дня dateKey включительно (МСК, дата признания). */
export function transactionOnOrBeforeReportMskDay(
  t: Transaction,
  bookings: Booking[],
  dateKey: string
): boolean {
  if (!isTransactionRecognized(t, bookings)) return false;
  return mskDateKey(transactionReportDate(t, bookings)) <= dateKey;
}

export function transactionInReportMonth(
  t: Transaction,
  bookings: Booking[],
  year: number,
  month: number
): boolean {
  if (!isTransactionRecognized(t, bookings)) return false;
  const d = transactionReportDate(t, bookings);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function isExpenseType(type: Transaction["type"]): boolean {
  return type === "expense" || type === "encashment" || type === "refund";
}

/** Сумма дохода по транзакции (расходы и возвраты не входят). */
export function revenueAmount(t: Transaction): number {
  if (isTransactionCancelled(t)) return 0;
  if (isExpenseType(t.type)) return 0;
  return t.amount;
}

/** Сумма расхода по транзакции (включая возвраты гостям). */
export function expenseAmount(t: Transaction): number {
  if (isTransactionCancelled(t)) return 0;
  if (isExpenseType(t.type)) return t.amount;
  return 0;
}

/** Изменение баланса способа оплаты / кассы. */
export function balanceDelta(t: Transaction): number {
  if (isTransactionCancelled(t)) return 0;
  if (isExpenseType(t.type)) return -t.amount;
  return t.amount;
}

const CASH_CODE = "cash";

/** Накопительный остаток наличных с учётом OTA и даты признания (МСК). */
export function calcCashBalance(
  transactions: Transaction[],
  bookings: Booking[],
  upToDateKey?: string
): number {
  return transactions
    .filter((t) => {
      if (t.paymentMethod !== CASH_CODE) return false;
      if (!isTransactionRecognized(t, bookings)) return false;
      if (upToDateKey && !transactionOnOrBeforeReportMskDay(t, bookings, upToDateKey)) return false;
      return true;
    })
    .reduce((s, t) => s + balanceDelta(t), 0);
}

/** Коды способов оплаты: активные из справочника + фактически встречающиеся в транзакциях. */
export function mergePaymentCodes(
  paymentMethods: PaymentMethodDef[],
  txs: Transaction[]
): string[] {
  const active = pmCodes(paymentMethods);
  const fromTx = Array.from(new Set(txs.map((t) => t.paymentMethod)));
  const extra = fromTx.filter((c) => !active.includes(c)).sort();
  return [...active, ...extra];
}

/** Баланс по способу оплаты с учётом отложенного OTA-проживания. */
export function calcPaymentBalances(
  transactions: Transaction[],
  bookings: Booking[],
  codes: string[]
): Record<string, number> {
  const b: Record<string, number> = {};
  for (const code of codes) b[code] = 0;

  for (const t of transactions) {
    if (!codes.includes(t.paymentMethod)) continue;
    if (!isTransactionRecognized(t, bookings)) continue;
    b[t.paymentMethod] += balanceDelta(t);
  }
  return b;
}
