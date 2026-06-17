const KNOWN_PREFIXES = [
  "7", "375", "380", "1", "49", "33", "44", "86", "971", "39", "34", "48",
  "995", "374", "996", "998", "994", "373", "372", "371", "370", "90", "82",
  "81", "61", "55", "52", "91", "66", "84", "62", "60", "65", "63", "64",
];

export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, "");
}

export function isValidPhone(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true;

  const phone = normalizePhone(trimmed);
  if (!phone.startsWith("+")) return false;

  const digits = phone.slice(1);
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length < 10 || digits.length > 15) return false;

  return KNOWN_PREFIXES.some((p) => digits.startsWith(p)) || digits.length >= 10;
}

export function phoneValidationMessage(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("+")) {
    return "Телефон должен начинаться с кода страны, например +7 или +375";
  }
  if (!isValidPhone(trimmed)) {
    return "Некорректный номер. Пример: +7 999 123-45-67, +375 29 123-45-67";
  }
  return null;
}

export function formatPhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned === "+") return "+";
  if (!cleaned.startsWith("+")) return `+${cleaned.replace(/\+/g, "")}`;
  return `+${cleaned.slice(1).replace(/\+/g, "")}`;
}
