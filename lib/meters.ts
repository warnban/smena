export type UtilityMeterType = "gvs" | "hvs" | "electricity";

export const METER_TYPE_CONFIG: Record<
  UtilityMeterType,
  { label: string; unit: string; bg: string; text: string; border: string }
> = {
  gvs: { label: "ГВС", unit: "м³", bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
  hvs: { label: "ХВС", unit: "м³", bg: "#DBEAFE", text: "#2563EB", border: "#93C5FD" },
  electricity: { label: "ЭЭ", unit: "кВт·ч", bg: "#FEF9C3", text: "#CA8A04", border: "#FDE047" },
};

export const METER_TYPE_OPTIONS: { value: UtilityMeterType; label: string }[] = [
  { value: "gvs", label: "ГВС — горячая вода" },
  { value: "hvs", label: "ХВС — холодная вода" },
  { value: "electricity", label: "ЭЭ — электроэнергия" },
];

export function formatMeterValue(value: number, type: UtilityMeterType): string {
  const unit = METER_TYPE_CONFIG[type].unit;
  return `${value.toFixed(2)} ${unit}`;
}

export function formatMeterDelta(delta: number | null): string {
  if (delta == null) return "";
  const sign = delta >= 0 ? "+" : "";
  return `(${sign}${delta.toFixed(2)})`;
}

export function periodKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function formatPeriodLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
