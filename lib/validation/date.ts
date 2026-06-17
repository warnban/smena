export function parseRuDate(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatRuDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Маска ввода ДД.ММ.ГГГГ при наборе с клавиатуры */
export function formatRuDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function ruDateToIso(s: string): string {
  const d = parseRuDate(s);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoToRuDate(s: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function isValidRuDate(s: string): boolean {
  if (!s.trim()) return true;
  return parseRuDate(s) !== null;
}

export function isValidBirthDate(s: string): boolean {
  if (!s.trim()) return true;
  const d = parseRuDate(s);
  if (!d) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return false;

  const min = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  return d >= min;
}

export function isValidPastOrTodayDate(s: string): boolean {
  if (!s.trim()) return true;
  const d = parseRuDate(s);
  if (!d) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
}

export function isValidFutureOrTodayDate(s: string): boolean {
  if (!s.trim()) return true;
  const d = parseRuDate(s);
  if (!d) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

export function ruDateValidationMessage(
  s: string,
  kind: "birth" | "past" | "future" | "any" = "any"
): string | null {
  if (!s.trim()) return null;
  if (!isValidRuDate(s)) return "Формат: ДД.ММ.ГГГГ";

  if (kind === "birth" && !isValidBirthDate(s)) {
    return "Некорректная дата рождения";
  }
  if (kind === "past" && !isValidPastOrTodayDate(s)) {
    return "Дата не может быть в будущем";
  }
  if (kind === "future" && !isValidFutureOrTodayDate(s)) {
    return "Дата не может быть в прошлом";
  }
  return null;
}
