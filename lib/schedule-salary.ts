export type ShiftRole = "day_admin" | "night_admin" | "housekeeping";

export const SHIFT_ROLE_LABELS: Record<ShiftRole, string> = {
  day_admin: "Дневная смена",
  night_admin: "Ночная смена",
  housekeeping: "Горничная",
};

export const SHIFT_ROLE_COLORS: Record<ShiftRole, { bg: string; text: string; border: string }> = {
  day_admin: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  night_admin: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  housekeeping: { bg: "#F0FDF4", text: "#059669", border: "#A7F3D0" },
};

export type ScheduleEntry = {
  id?: string;
  date: string;
  staffId: string;
  staffName?: string;
  role: ShiftRole;
};

export type StaffRates = {
  dayShiftRate: number;
  nightShiftRate: number;
  hkShiftRate: number;
};

export type OccupancyRateTier = {
  minOccupancy: number;
  maxOccupancy: number;
  dayRate: number;
  nightRate: number;
};

export type HkRateSettings = {
  hkSoloRate: number;
  hkDuoRate: number;
};

export function hkCountOnDate(schedule: ScheduleEntry[], date: string): number {
  return schedule.filter((e) => e.date === date && e.role === "housekeeping").length;
}

export function resolveShiftAmount(
  entry: ScheduleEntry,
  schedule: ScheduleEntry[],
  occupancy: number | null | undefined,
  tiers: OccupancyRateTier[],
  hk: HkRateSettings
): number {
  if (entry.role === "housekeeping") {
    const count = hkCountOnDate(schedule, entry.date);
    return count <= 1 ? hk.hkSoloRate : hk.hkDuoRate;
  }

  const fallback = rateForShift(entry.role, DEFAULT_HOTEL_SHIFT_RATES);
  if (!tiers.length || occupancy == null) return fallback;
  const tier = tiers.find((t) => occupancy >= t.minOccupancy && occupancy <= t.maxOccupancy);
  if (!tier) return fallback;
  if (entry.role === "day_admin") return tier.dayRate;
  return tier.nightRate;
}

export function rateForShift(role: ShiftRole, rates: StaffRates): number {
  if (role === "day_admin") return rates.dayShiftRate;
  if (role === "night_admin") return rates.nightShiftRate;
  return rates.hkShiftRate;
}

export const DEFAULT_HOTEL_SHIFT_RATES: StaffRates = {
  dayShiftRate: 2500,
  nightShiftRate: 3000,
  hkShiftRate: 1800,
};

export function rateForShiftWithOccupancy(
  role: ShiftRole,
  _rates: StaffRates,
  occupancy: number | null | undefined,
  tiers: OccupancyRateTier[]
): number {
  if (role === "housekeeping") {
    return DEFAULT_HOTEL_SHIFT_RATES.hkShiftRate;
  }
  const fallback = rateForShift(role, DEFAULT_HOTEL_SHIFT_RATES);
  if (!tiers.length || occupancy == null) return fallback;
  const tier = tiers.find((t) => occupancy >= t.minOccupancy && occupancy <= t.maxOccupancy);
  if (!tier) return fallback;
  if (role === "day_admin") return tier.dayRate;
  return tier.nightRate;
}

/** @deprecated Используйте mskDateKey из @/lib/msk-time */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** @deprecated Используйте mondayOfMsk из @/lib/msk-time */
export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** @deprecated Используйте weekDateKeys из @/lib/msk-time */
export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export type SalarySummary = {
  staffId: string;
  staffName: string;
  role: string;
  shiftCount: number;
  accrued: number;
  paid: number;
  penalties: number;
  balance: number;
  shifts: { date: string; role: ShiftRole; amount: number; occupancy?: number; hkCount?: number }[];
};

export function buildSalarySummaries(params: {
  schedule: ScheduleEntry[];
  staff: Array<{
    id: string;
    name: string;
    role: string;
    dayShiftRate: number;
    nightShiftRate: number;
    hkShiftRate: number;
  }>;
  payments: Array<{ staffId: string; type: "payment" | "bonus" | "penalty"; amount: number }>;
  periodFrom?: string;
  periodTo?: string;
  occupancyByDate?: Record<string, number>;
  occupancyTiers?: OccupancyRateTier[];
  hkRates?: HkRateSettings;
}): SalarySummary[] {
  const { schedule, staff, payments, periodFrom, periodTo, occupancyByDate, occupancyTiers, hkRates } = params;
  const hk: HkRateSettings = hkRates ?? { hkSoloRate: 5000, hkDuoRate: 3500 };
  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]));

  const filteredSchedule = schedule.filter((e) => {
    if (periodFrom && e.date < periodFrom) return false;
    if (periodTo && e.date > periodTo) return false;
    return true;
  });

  const byStaff: Record<string, SalarySummary> = {};

  for (const entry of filteredSchedule) {
    const s = staffMap[entry.staffId];
    if (!s) continue;
    if (!byStaff[entry.staffId]) {
      byStaff[entry.staffId] = {
        staffId: entry.staffId,
        staffName: s.name,
        role: s.role,
        shiftCount: 0,
        accrued: 0,
        paid: 0,
        penalties: 0,
        balance: 0,
        shifts: [],
      };
    }
    const occupancy = occupancyByDate?.[entry.date];
    const amount = resolveShiftAmount(entry, filteredSchedule, occupancy, occupancyTiers ?? [], hk);
    byStaff[entry.staffId].shiftCount += 1;
    byStaff[entry.staffId].accrued += amount;
    const hkCount = entry.role === "housekeeping" ? hkCountOnDate(filteredSchedule, entry.date) : undefined;
    byStaff[entry.staffId].shifts.push({
      date: entry.date,
      role: entry.role,
      amount,
      occupancy: entry.role === "housekeeping" ? undefined : occupancy,
      hkCount,
    });
  }

  for (const p of payments) {
    if (!byStaff[p.staffId]) {
      const s = staffMap[p.staffId];
      if (!s) continue;
      byStaff[p.staffId] = {
        staffId: p.staffId,
        staffName: s.name,
        role: s.role,
        shiftCount: 0,
        accrued: 0,
        paid: 0,
        penalties: 0,
        balance: 0,
        shifts: [],
      };
    }
    if (p.type === "penalty") {
      byStaff[p.staffId].penalties += p.amount;
    } else {
      byStaff[p.staffId].paid += p.amount;
    }
  }

  return Object.values(byStaff).map((row) => ({
    ...row,
    balance: row.accrued - row.paid - row.penalties,
    shifts: row.shifts.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

export function adminsFromSchedule(
  schedule: ScheduleEntry[],
  date: string
): { dayAdminName: string; nightAdminName: string } {
  const day = schedule.find((e) => e.date === date && e.role === "day_admin");
  const night = schedule.find((e) => e.date === date && e.role === "night_admin");
  return {
    dayAdminName: day?.staffName ?? "",
    nightAdminName: night?.staffName ?? "",
  };
}
