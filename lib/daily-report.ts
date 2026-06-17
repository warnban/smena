import type { Booking, Room, Transaction } from "@/lib/types";
import type { PaymentMethodDef } from "@/lib/payment-methods";
import { money, fmtDateRu } from "@/lib/format";
import {
  calcCashBalance,
  expenseAmount,
  isExpenseType,
  mergePaymentCodes,
  revenueAmount,
  transactionOnReportMskDay,
} from "@/lib/finance";
import { parseMskDateKey, fmtMskDateTime } from "@/lib/msk-time";

const ACCOMMODATION = "accommodation";
const MS_DAY = 86_400_000;

export type DailyPmBreakdown = {
  code: string;
  accommodation: number;
  total: number;
};

export type DailyReportData = {
  occupancy: number;
  soldNights: number;
  availableNights: number;
  accommodationTotal: number;
  grandTotal: number;
  expensesTotal: number;
  expenseOnlyTotal: number;
  encashmentTotal: number;
  cashOpening: number;
  cashClosing: number;
  byPayment: DailyPmBreakdown[];
  dayAdminName: string;
  nightAdminName: string;
};

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function countDayOccupancy(bookings: Booking[], rooms: Room[], date: Date): number {
  const occupied = bookings.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.checkIn <= date &&
      b.checkOut > date &&
      (b.status === "checkedin" || b.status === "confirmed" || b.status === "new")
  ).length;
  return rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;
}

function previousDateKey(dateKey: string): string {
  const d = parseMskDateKey(dateKey);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function buildDailyCloseReport(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  dateKey: string,
  paymentMethods: PaymentMethodDef[],
  shift?: { dayAdminName: string; nightAdminName: string }
): DailyReportData {
  const date = parseMskDateKey(dateKey);
  const dayTx = transactions.filter((t) => transactionOnReportMskDay(t, bookings, dateKey));

  const revenueTx = dayTx.filter((t) => !isExpenseType(t.type));
  const expenseTx = dayTx.filter((t) => t.type === "expense" || t.type === "refund");
  const encashmentTx = dayTx.filter((t) => t.type === "encashment");

  const codes = mergePaymentCodes(paymentMethods, revenueTx);

  const byPayment: DailyPmBreakdown[] = codes.map((code) => {
    const acc = revenueTx
      .filter((t) => t.paymentMethod === code && t.category === ACCOMMODATION)
      .reduce((s, t) => s + revenueAmount(t), 0);
    const total = revenueTx
      .filter((t) => t.paymentMethod === code)
      .reduce((s, t) => s + revenueAmount(t), 0);
    return { code, accommodation: acc, total };
  });

  const accommodationTotal = revenueTx
    .filter((t) => t.category === ACCOMMODATION)
    .reduce((s, t) => s + revenueAmount(t), 0);

  const expenseOnlyTotal = expenseTx.reduce((s, t) => s + expenseAmount(t), 0);
  const encashmentTotal = encashmentTx.reduce((s, t) => s + expenseAmount(t), 0);
  const expensesTotal = expenseOnlyTotal + encashmentTotal;
  const grandTotal = revenueTx.reduce((s, t) => s + revenueAmount(t), 0);

  const cashOpening = calcCashBalance(transactions, bookings, previousDateKey(dateKey));
  const cashClosing = calcCashBalance(transactions, bookings, dateKey);

  const soldNights = bookings.reduce((s, b) => {
    if (b.status === "cancelled") return s;
    if (sameDay(b.checkIn, date)) {
      const nights = Math.max(1, Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / MS_DAY));
      return s + nights;
    }
    return s;
  }, 0);

  return {
    occupancy: countDayOccupancy(bookings, rooms, date),
    soldNights,
    availableNights: rooms.length,
    accommodationTotal,
    grandTotal,
    expensesTotal,
    expenseOnlyTotal,
    encashmentTotal,
    cashOpening,
    cashClosing,
    byPayment,
    dayAdminName: shift?.dayAdminName ?? "",
    nightAdminName: shift?.nightAdminName ?? "",
  };
}

export type StoredDailyReport = {
  id: string;
  hotelId: string;
  date: string;
  dayAdminName: string;
  nightAdminName: string;
  occupancy: number;
  cashOpening: number;
  cashClosing: number;
  accommodationTotal: number;
  grandTotal: number;
  expensesTotal: number;
  encashmentTotal: number;
  expenseOnlyTotal: number;
  byPayment: DailyPmBreakdown[];
  closedAt: string;
};

export function storedReportFromDb(row: {
  id: string;
  hotelId: string;
  date: Date;
  dayAdminName: string;
  nightAdminName: string;
  occupancy: number;
  cashOpening: number;
  cashClosing: number;
  accommodationTotal: number;
  grandTotal: number;
  expensesTotal: number;
  encashmentTotal: number;
  byPayment: unknown;
  closedAt: Date;
}): StoredDailyReport {
  const byPayment = Array.isArray(row.byPayment) ? (row.byPayment as DailyPmBreakdown[]) : [];
  const expenseOnlyTotal = row.expensesTotal - row.encashmentTotal;
  return {
    id: row.id,
    hotelId: row.hotelId,
    date: row.date.toISOString().slice(0, 10),
    dayAdminName: row.dayAdminName,
    nightAdminName: row.nightAdminName,
    occupancy: row.occupancy,
    cashOpening: row.cashOpening,
    cashClosing: row.cashClosing,
    accommodationTotal: row.accommodationTotal,
    grandTotal: row.grandTotal,
    expensesTotal: row.expensesTotal,
    encashmentTotal: row.encashmentTotal,
    expenseOnlyTotal,
    byPayment,
    closedAt: row.closedAt.toISOString(),
  };
}

export function formatDailyReportText(
  hotelName: string,
  dateKey: string,
  report: Pick<
    DailyReportData,
    | "occupancy"
    | "dayAdminName"
    | "nightAdminName"
    | "accommodationTotal"
    | "grandTotal"
    | "expensesTotal"
    | "cashClosing"
    | "byPayment"
  > & {
    encashmentTotal?: number;
    expenseOnlyTotal?: number;
  },
  paymentLabels: Record<string, string>,
  closedAt?: string
): string {
  const lines: string[] = [
    "ЕЖЕДНЕВНЫЙ ОТЧЁТ",
    `Отель: ${hotelName}`,
    `Дата: ${fmtDateRu(parseMskDateKey(dateKey))}`,
  ];
  if (closedAt) lines.push(`Закрыт: ${fmtMskDateTime(new Date(closedAt))} (МСК)`);
  lines.push(
    `Загрузка: ${report.occupancy}%`,
    `День: ${report.dayAdminName || "—"}`,
    `Ночь: ${report.nightAdminName || "—"}`,
    "",
    "ВЫРУЧКА ПО СПОСОБАМ ОПЛАТЫ"
  );
  for (const row of report.byPayment) {
    if (row.accommodation === 0 && row.total === 0) continue;
    const label = paymentLabels[row.code] ?? row.code;
    lines.push(`${label}: гости ${money(row.accommodation)}, всего ${money(row.total)}`);
  }
  lines.push(
    "",
    `Выручка гости: ${money(report.accommodationTotal)}`,
    `Общая выручка: ${money(report.grandTotal)}`,
    "",
    `Расходы: −${money(report.expensesTotal)}`
  );
  if ((report.encashmentTotal ?? 0) > 0) {
    let detail = `в т.ч. инкассация −${money(report.encashmentTotal ?? 0)}`;
    if ((report.expenseOnlyTotal ?? 0) > 0) {
      detail += `, прочие расходы −${money(report.expenseOnlyTotal ?? 0)}`;
    }
    lines.push(detail);
  }
  lines.push("", `Итого денег в кассе: ${money(report.cashClosing)}`);
  return lines.join("\n");
}

export function reportDataToStored(
  hotelId: string,
  dateKey: string,
  data: DailyReportData
): Omit<StoredDailyReport, "id" | "closedAt"> {
  return {
    hotelId,
    date: dateKey,
    dayAdminName: data.dayAdminName,
    nightAdminName: data.nightAdminName,
    occupancy: data.occupancy,
    cashOpening: data.cashOpening,
    cashClosing: data.cashClosing,
    accommodationTotal: data.accommodationTotal,
    grandTotal: data.grandTotal,
    expensesTotal: data.expensesTotal,
    encashmentTotal: data.encashmentTotal,
    expenseOnlyTotal: data.expenseOnlyTotal,
    byPayment: data.byPayment,
  };
}
