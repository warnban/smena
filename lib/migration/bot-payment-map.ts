import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";

const KNOWN: Record<string, { code: string; label: string; color: string; bg: string; icon: string }> = {
  "наличные": { code: "cash", label: "Наличные", color: "#059669", bg: "#F0FDF4", icon: "Banknote" },
  "терминал": { code: "card", label: "Карта", color: "#2563EB", bg: "#EFF6FF", icon: "CreditCard" },
  "qr-код": { code: "online", label: "Онлайн/СБП", color: "#0891B2", bg: "#ECFEFF", icon: "Smartphone" },
  "qr код": { code: "online", label: "Онлайн/СБП", color: "#0891B2", bg: "#ECFEFF", icon: "Smartphone" },
  "переводы юр.лиц": { code: "transfer", label: "Перевод", color: "#7C3AED", bg: "#F5F3FF", icon: "ArrowDownLeft" },
  "переводы юр. лиц": { code: "transfer", label: "Перевод", color: "#7C3AED", bg: "#F5F3FF", icon: "ArrowDownLeft" },
  "через партнёра": { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  "через партнера": { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  "комфорт букинг": { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  "комофрт букинг": { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  "фактический выезд": { code: "ota", label: "OTA предопл.", color: "#D97706", bg: "#FFFBEB", icon: "Globe" },
  "все способы": { code: "cash", label: "Наличные", color: "#059669", bg: "#F0FDF4", icon: "Banknote" },
};

function slugCode(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base ? `custom_${base}` : "custom_other";
}

export function mapBotPaymentLabel(label: string | null | undefined): {
  code: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  isNew: boolean;
} {
  const raw = (label ?? "Наличные").trim();
  const key = raw.toLowerCase();
  const known = KNOWN[key];
  if (known) return { ...known, isNew: false };

  const def = DEFAULT_PAYMENT_METHODS[0]!;
  return {
    code: slugCode(raw),
    label: raw,
    color: def.color,
    bg: def.bg,
    icon: def.icon,
    isNew: true,
  };
}

export function isGuestCategory(category: string | null | undefined): boolean {
  return /гост/i.test(category ?? "");
}

export function mapBotTransactionType(
  type: string,
  category: string | null,
  hasGuest: boolean
): "payment" | "expense" | "encashment" | "refund" {
  const cat = (category ?? "").trim();
  if (type === "TRANSFER" || cat.toLowerCase() === "инкассация") return "encashment";
  if (type === "EXPENSE") {
    if (/возврат/i.test(cat)) return "refund";
    return "expense";
  }
  if (hasGuest || isGuestCategory(cat)) return "payment";
  return "payment";
}

export function mapBotExpenseCategory(category: string | null): string {
  const cat = (category ?? "").trim();
  if (!cat || cat.toLowerCase() === "инкассация") return "other";
  return cat
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "other";
}
