import "server-only";

import { prisma } from "@/lib/prisma";
import { isExpenseType, isTransactionCancelled } from "@/lib/finance";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import type { Transaction } from "@/lib/types";

const ACCOMMODATION = "accommodation";

export async function isReportDayClosed(hotelId: string, dateKey: string): Promise<boolean> {
  const report = await prisma.dailyReport.findUnique({
    where: { hotelId_date: { hotelId, date: parseMskDateKey(dateKey) } },
  });
  return Boolean(report);
}

export function isAccommodationTransaction(
  tx: Pick<Transaction, "category" | "type" | "bookingId" | "organizationStayId">
): boolean {
  if (tx.category === ACCOMMODATION) return true;
  if (tx.type === "refund") return true;
  if (tx.type === "payment" && tx.bookingId) return true;
  if (tx.organizationStayId) return true;
  return false;
}

export async function canEditTransaction(
  tx: Transaction & { id: string; hotelId: string; date: Date }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isTransactionCancelled(tx)) {
    return { ok: false, reason: "Транзакция отменена" };
  }
  if (isAccommodationTransaction(tx)) {
    return { ok: false, reason: "Платежи за проживание нельзя редактировать" };
  }

  const [refund, salary] = await Promise.all([
    prisma.refundRecord.findUnique({ where: { transactionId: tx.id } }),
    prisma.salaryLedgerEntry.findUnique({ where: { transactionId: tx.id } }),
  ]);
  if (refund) return { ok: false, reason: "Возвраты нельзя редактировать" };
  if (salary) return { ok: false, reason: "Зарплатные операции нельзя редактировать" };

  const dateKey = mskDateKey(tx.date);
  if (await isReportDayClosed(tx.hotelId, dateKey)) {
    return { ok: false, reason: "Сутки закрыты отчётом — редактирование недоступно" };
  }

  return { ok: true };
}

export function manualTxTypeFromDirection(direction: "income" | "expense"): "payment" | "expense" {
  return direction === "expense" ? "expense" : "payment";
}

export function directionFromTxType(type: Transaction["type"]): "income" | "expense" {
  return isExpenseType(type) ? "expense" : "income";
}
