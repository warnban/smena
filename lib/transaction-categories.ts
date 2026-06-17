import { TX_CAT_LABELS } from "@/lib/tx-categories";

/** Категории, недоступные для ручного создания транзакций. */
export const MANUAL_TX_BLOCKED_CATEGORIES = new Set(["accommodation", "encashment", "salary", "bonus"]);

export function categoryCodeFromLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "extra";

  const byLabel = Object.entries(TX_CAT_LABELS).find(
    ([, l]) => l.toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return byLabel[0];

  const byKey = TX_CAT_LABELS[trimmed as keyof typeof TX_CAT_LABELS];
  if (byKey) return trimmed;

  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\u0400-\u04ff]/gi, "")
    .slice(0, 48);

  return slug || `cat_${Date.now().toString(36)}`;
}

export function normalizeCategoryLabel(label: string): string {
  return label.trim().slice(0, 80);
}

export type TransactionCategoryOption = {
  code: string;
  label: string;
  custom?: boolean;
};

export function buildCategoryOptions(
  custom: { code: string; label: string }[]
): TransactionCategoryOption[] {
  const seen = new Set<string>();
  const out: TransactionCategoryOption[] = [];

  for (const [code, label] of Object.entries(TX_CAT_LABELS)) {
    if (MANUAL_TX_BLOCKED_CATEGORIES.has(code)) continue;
    out.push({ code, label });
    seen.add(code);
  }

  for (const c of custom) {
    if (seen.has(c.code)) continue;
    out.push({ code: c.code, label: c.label, custom: true });
    seen.add(c.code);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function categoryLabel(code: string, custom: { code: string; label: string }[] = []): string {
  return TX_CAT_LABELS[code] ?? custom.find((c) => c.code === code)?.label ?? code;
}
