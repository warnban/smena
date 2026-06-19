export type BookingSourceDef = {
  id: string;
  code: string;
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  sortOrder: number;
  active: boolean;
};

export type SourceStyle = {
  bg: string;
  text: string;
  border: string;
  solid: string;
  label: string;
};

export const DEFAULT_BOOKING_SOURCES: Omit<BookingSourceDef, "id" | "active">[] = [
  { code: "booking", label: "Booking.com", color: "#16A34A", bg: "#DCFCE7", text: "#166534", border: "#86EFAC", sortOrder: 0 },
  { code: "expedia", label: "Expedia", color: "#2563EB", bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD", sortOrder: 1 },
  { code: "direct", label: "Прямое", color: "#D97706", bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", sortOrder: 2 },
  { code: "ostrovok", label: "Ostrovok", color: "#DC2626", bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5", sortOrder: 3 },
  { code: "yandex", label: "Яндекс", color: "#EA580C", bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74", sortOrder: 4 },
];

const FALLBACK_STYLE: SourceStyle = {
  bg: "#F1F5F9",
  text: "#64748B",
  border: "#E2E8F0",
  solid: "#64748B",
  label: "",
};

export function buildSourceConfig(sources: BookingSourceDef[]): Record<string, SourceStyle> {
  const active = sources.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(
    active.map((s) => [
      s.code,
      { bg: s.bg, text: s.text, border: s.border, solid: s.color, label: s.label },
    ])
  );
}

export function sourceStyle(config: Record<string, SourceStyle>, code: string): SourceStyle {
  return config[code] ?? { ...FALLBACK_STYLE, label: code };
}

export function sourceCodes(sources: BookingSourceDef[]): string[] {
  return sources.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.code);
}
