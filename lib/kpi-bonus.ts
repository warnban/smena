import type { Bed, Booking, Room, Transaction } from "@/lib/types";
import { calcMonthStats } from "@/lib/reporting";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import type { KpiMetric } from "@prisma/client";

export const KPI_METRIC_LABELS: Record<KpiMetric, string> = {
  revpar: "RevPAR за месяц",
  occupancy: "Средняя загрузка за месяц",
  cash_revenue: "Выручка наличными за месяц",
  total_revenue: "Общая выручка за месяц",
  adr: "ADR за месяц",
};

export const KPI_METRIC_UNITS: Record<KpiMetric, string> = {
  revpar: "₽",
  occupancy: "%",
  cash_revenue: "₽",
  total_revenue: "₽",
  adr: "₽",
};

export function kpiThresholdHint(metric: KpiMetric): string {
  const unit = KPI_METRIC_UNITS[metric];
  if (metric === "occupancy") return `Порог в процентах, например 70${unit}`;
  return `Минимальное значение в ${unit}, при котором начисляется премия`;
}

export type KpiSnapshot = {
  revpar: number;
  occupancy: number;
  cash_revenue: number;
  total_revenue: number;
  adr: number;
};

export function buildKpiSnapshot(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  year: number,
  month: number,
  beds: Bed[] = []
): KpiSnapshot {
  const stats = calcMonthStats(transactions, bookings, rooms, year, month, beds);
  const cashRevenue = transactions
    .filter((t) => {
      const key = mskDateKey(t.date);
      const d = parseMskDateKey(key);
      return d.getUTCFullYear() === year && d.getUTCMonth() === month && t.paymentMethod === "cash" && t.type !== "expense" && t.type !== "encashment" && t.type !== "refund";
    })
    .reduce((s, t) => s + t.amount, 0);

  return {
    revpar: Math.round(stats.revpar),
    occupancy: Math.round(stats.occupancy * 10) / 10,
    cash_revenue: cashRevenue,
    total_revenue: Math.round(stats.roomRevenue),
    adr: Math.round(stats.adr),
  };
}

export function metricValue(snapshot: KpiSnapshot, metric: KpiMetric): number {
  return snapshot[metric];
}

export function rulesMet(snapshot: KpiSnapshot, rules: { metric: KpiMetric; threshold: number; bonusAmount: number; active: boolean; label: string }[]) {
  return rules
    .filter((r) => r.active)
    .filter((r) => metricValue(snapshot, r.metric) >= r.threshold)
    .map((r) => ({ ...r, actual: metricValue(snapshot, r.metric) }));
}

export function parsePeriodMonth(periodMonth: string): { year: number; month: number } {
  const [y, m] = periodMonth.split("-").map(Number);
  return { year: y, month: (m ?? 1) - 1 };
}

export function periodMonthKeys(periodMonth: string): { from: string; to: string } {
  const { year, month } = parsePeriodMonth(periodMonth);
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
