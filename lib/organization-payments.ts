import type { Transaction } from "@/lib/types";

export function filterOrganizationTransactions(
  organizationId: string,
  transactions: Transaction[]
): Transaction[] {
  return transactions
    .filter((t) => t.organizationId === organizationId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
