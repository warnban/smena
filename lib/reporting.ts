import type { Bed, Booking, Room, Transaction } from "@/lib/types";
import { sellableUnits } from "@/lib/occupancy-capacity";
import {
  isExpenseType,
  revenueAmount,
  transactionInReportMonth,
} from "@/lib/finance";

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MS_DAY = 86_400_000;
const ACCOMMODATION = "accommodation";

export interface MonthlyReportRow {
  m: string;
  rev: number;
  roomRev: number;
  occ: number;
  adr: number;
  revpar: number;
  [paymentCode: string]: number | string;
}

export interface MonthStats {
  roomRevenue: number;
  soldNights: number;
  availableNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthBounds(year: number, month: number) {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
    days: daysInMonth(year, month),
  };
}

export function countSoldNights(
  bookings: Booking[],
  periodStart: Date,
  periodEnd: Date
): number {
  let nights = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const start = b.checkIn < periodStart ? periodStart : b.checkIn;
    const end = b.checkOut > periodEnd ? periodEnd : b.checkOut;
    if (end > start) {
      nights += Math.ceil((end.getTime() - start.getTime()) / MS_DAY);
    }
  }
  return nights;
}

function roomRevenueInMonth(
  transactions: Transaction[],
  bookings: Booking[],
  year: number,
  month: number
): number {
  return transactions
    .filter(
      (t) =>
        !isExpenseType(t.type) &&
        t.category === ACCOMMODATION &&
        transactionInReportMonth(t, bookings, year, month)
    )
    .reduce((s, t) => s + revenueAmount(t), 0);
}

export function calcMonthStats(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  year: number,
  month: number,
  beds: Bed[] = []
): MonthStats {
  const { start, end, days } = monthBounds(year, month);
  const unitCount = sellableUnits(rooms, beds);
  const availableNights = unitCount * days;
  const soldNights = countSoldNights(bookings, start, end);
  const roomRevenue = roomRevenueInMonth(transactions, bookings, year, month);

  const occupancy =
    availableNights > 0 ? Math.round((soldNights / availableNights) * 100) : 0;
  const adr = soldNights > 0 ? Math.round(roomRevenue / soldNights) : 0;
  const revpar = availableNights > 0 ? Math.round(roomRevenue / availableNights) : 0;

  return { roomRevenue, soldNights, availableNights, occupancy, adr, revpar };
}

function pctTrend(current: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((current - prev) / prev) * 100);
}

export function buildMonthlyReport(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  paymentCodes: string[],
  months = 6,
  beds: Bed[] = []
): MonthlyReportRow[] {
  const now = new Date();
  const rows: MonthlyReportRow[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = MONTH_LABELS[month];

    const monthRevTx = transactions.filter(
      (t) =>
        transactionInReportMonth(t, bookings, year, month) && !isExpenseType(t.type)
    );

    const rev = monthRevTx.reduce((s, t) => s + revenueAmount(t), 0);
    const pm: Record<string, number> = {};
    for (const code of paymentCodes) pm[code] = 0;
    monthRevTx.forEach((t) => {
      const signed = revenueAmount(t);
      if (t.paymentMethod in pm) pm[t.paymentMethod] += signed;
      else pm[t.paymentMethod] = (pm[t.paymentMethod] ?? 0) + signed;
    });

    const stats = calcMonthStats(transactions, bookings, rooms, year, month, beds);

    rows.push({
      m: label,
      rev,
      roomRev: stats.roomRevenue,
      occ: stats.occupancy,
      adr: stats.adr,
      revpar: stats.revpar,
      ...pm,
    });
  }

  return rows;
}

export function calcKpis(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  paymentCodes: string[] = [],
  beds: Bed[] = []
) {
  const monthly = buildMonthlyReport(transactions, bookings, rooms, paymentCodes, 6, beds);
  const current = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];

  const now = new Date();
  const currentStats = calcMonthStats(
    transactions,
    bookings,
    rooms,
    now.getFullYear(),
    now.getMonth(),
    beds
  );
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevStats = calcMonthStats(
    transactions,
    bookings,
    rooms,
    prevMonth.getFullYear(),
    prevMonth.getMonth(),
    beds
  );

  const totalRev = monthly.reduce((s, r) => s + r.rev, 0);

  return {
    occupancy: currentStats.occupancy,
    occupancyTrend: pctTrend(currentStats.occupancy, prevStats.occupancy),
    adr: currentStats.adr,
    adrTrend: pctTrend(currentStats.adr, prevStats.adr),
    revpar: currentStats.revpar,
    revparTrend: pctTrend(currentStats.revpar, prevStats.revpar),
    totalRevenue: totalRev,
    revenueTrend: prev ? pctTrend(current?.rev ?? 0, prev.rev) : 0,
    spark: monthly.map((r) => r.occ),
    adrSpark: monthly.map((r) => r.adr),
    revparSpark: monthly.map((r) => r.revpar),
    roomRevenueMonth: currentStats.roomRevenue,
    soldNightsMonth: currentStats.soldNights,
  };
}
