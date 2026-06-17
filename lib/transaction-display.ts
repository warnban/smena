import { isExpenseType, isTransactionCancelled } from "@/lib/finance";
import type { Transaction } from "@/lib/types";

export function txTypeLabel(type: Transaction["type"]): string {
  switch (type) {
    case "encashment":
      return "Инкассация";
    case "expense":
      return "Расход";
    case "refund":
      return "Возврат";
    case "service":
      return "Услуга";
    default:
      return "Оплата";
  }
}

export function txIsOutflow(t: Transaction): boolean {
  return isExpenseType(t.type);
}

export function txPartyLabel(t: Transaction): string {
  if (t.guestName?.trim()) return t.guestName.trim();
  if (t.type === "encashment") return "Инкассация";
  if (t.type === "expense") return "Расход";
  return "—";
}

export function txListSubtitle(t: Transaction): string {
  const parts: string[] = [txTypeLabel(t.type)];
  if (t.roomNumber) parts.push(`№${t.roomNumber}`);
  return parts.join(" · ");
}

export function txAmountColor(t: Transaction, cancelled: boolean): string | undefined {
  if (cancelled) return undefined;
  return txIsOutflow(t) ? "#DC2626" : "#059669";
}

export { isTransactionCancelled };
