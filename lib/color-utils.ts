export const PM_COLOR_PRESETS = [
  { color: "#059669", label: "Зелёный" },
  { color: "#2563EB", label: "Синий" },
  { color: "#7C3AED", label: "Фиолетовый" },
  { color: "#D97706", label: "Янтарный" },
  { color: "#0891B2", label: "Бирюзовый" },
  { color: "#DC2626", label: "Красный" },
  { color: "#DB2777", label: "Розовый" },
  { color: "#64748B", label: "Серый" },
];

export function colorToBg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#F8FAFC";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * 0.12 + 255 * 0.88);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export function normalizeHexColor(input: string, fallback = "#059669"): string {
  const v = input.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  return fallback;
}
