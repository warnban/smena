/** Парсит номера коек из текста (строка или через запятую). */
export function parseBedNumbers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeBedNumbers(numbers: string[]): string[] {
  return numbers.map((n) => n.trim()).filter(Boolean);
}

export function findDuplicateBedNumbers(numbers: string[]): string | null {
  const seen = new Set<string>();
  for (const n of numbers) {
    const key = n.toLowerCase();
    if (seen.has(key)) return n;
    seen.add(key);
  }
  return null;
}
