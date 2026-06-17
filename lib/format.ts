export function money(n: number): string {
  return (n || 0).toLocaleString("ru-RU") + " ₽";
}

/** Компактный формат для аналитики: 2.9M ₽, 219k ₽, −1.2M ₽ */
export function compactMoney(n: number): string {
  const v = n || 0;
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const s = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `${sign}${s}M ₽`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k ₽`;
  return money(v);
}

export function inits(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const MONTHS = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function fmtDate(dt: Date | string, short = false): string {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  if (short) return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateRu(dt: Date | string): string {
  const d = typeof dt === "string" ? new Date(dt) : dt;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
