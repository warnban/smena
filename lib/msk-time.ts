const TZ = "Europe/Moscow";

/** Ключ даты YYYY-MM-DD по московскому времени. */
export function mskDateKey(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function parseMskDateKey(key: string): Date {
  return new Date(`${key.slice(0, 10)}T00:00:00.000Z`);
}

/** Следующий календарный день (МСК) после ключа YYYY-MM-DD. */
export function mskDayAfter(key: string): string {
  const d = parseMskDateKey(key);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Сдвиг ключа даты YYYY-MM-DD на N календарных дней (МСК). */
export function mskAddDays(key: string, days: number): string {
  const d = parseMskDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ночей проживания между датами заезда и выезда (календарные сутки МСК). */
export function mskNightDiff(checkIn: Date | string, checkOut: Date | string): number {
  const inKey = typeof checkIn === "string" ? checkIn.slice(0, 10) : mskDateKey(checkIn);
  const outKey = typeof checkOut === "string" ? checkOut.slice(0, 10) : mskDateKey(checkOut);
  const diff = Math.round(
    (parseMskDateKey(outKey).getTime() - parseMskDateKey(inKey).getTime()) / 86_400_000
  );
  return Math.max(1, diff);
}

/** Следующие сутки 00:01 МСК после указанной даты отчёта. */
export function mskUnlockAfterReport(reportDateKey: string): Date {
  const base = parseMskDateKey(reportDateKey);
  base.setUTCDate(base.getUTCDate() + 1);
  const nextKey = base.toISOString().slice(0, 10);
  return new Date(`${nextKey}T00:01:00+03:00`);
}

export function fmtMskDateTime(d: Date): string {
  return d.toLocaleString("ru-RU", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Заголовок дня для списков: «16 июня 2026, пн» */
export function fmtMskDayLabel(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Короткая подпись для ключа YYYY-MM-DD: «16 июн» или «16 июн 2026» */
export function fmtMskDateKey(key: string, short = false): string {
  const d = parseMskDateKey(key);
  const day = d.getUTCDate();
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const month = months[d.getUTCMonth()];
  if (short) return `${day} ${month}`;
  return `${day} ${month} ${d.getUTCFullYear()}`;
}

/** Понедельник недели для ключа или текущей даты (МСК). */
export function mondayOfMsk(refKey?: string): string {
  const key = refKey ?? mskDateKey();
  const d = parseMskDateKey(key);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return mskAddDays(key, diff);
}

/** 7 ключей дат Пн–Вс от понедельника. */
export function weekDateKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => mskAddDays(mondayKey, i));
}

export function isPaymentUnlockedAfterReport(reportDateKey: string): boolean {
  return Date.now() >= mskUnlockAfterReport(reportDateKey).getTime();
}

/** Дата транзакции в МСК (сырая, без правил OTA). Для отчётов используйте transactionOnReportMskDay. */
export function transactionOnMskDay(tDate: Date, dateKey: string): boolean {
  return mskDateKey(tDate) === dateKey;
}
