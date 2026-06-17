export type PaymentMethodDef = {
  id: string;
  code: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  sortOrder: number;
  active: boolean;
};

export type PmConfigEntry = {
  label: string;
  color: string;
  bg: string;
  icon: string;
};

export const DEFAULT_PAYMENT_METHODS: Omit<PaymentMethodDef, "id" | "active">[] = [
  { code: "cash", label: "Наличные", color: "#059669", bg: "#F0FDF4", icon: "Banknote", sortOrder: 0 },
  { code: "card", label: "Карта", color: "#2563EB", bg: "#EFF6FF", icon: "CreditCard", sortOrder: 1 },
  { code: "transfer", label: "Перевод", color: "#7C3AED", bg: "#F5F3FF", icon: "ArrowDownLeft", sortOrder: 2 },
  { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe", sortOrder: 3 },
  { code: "online", label: "Онлайн/СБП", color: "#0891B2", bg: "#ECFEFF", icon: "Smartphone", sortOrder: 4 },
];

export function buildPmConfig(methods: PaymentMethodDef[]): Record<string, PmConfigEntry> {
  const active = methods.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(
    active.map((m) => [m.code, { label: m.label, color: m.color, bg: m.bg, icon: m.icon }])
  );
}

export function pmCodes(methods: PaymentMethodDef[]): string[] {
  return methods.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.code);
}
