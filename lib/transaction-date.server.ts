import "server-only";

import type { UserRole } from "@prisma/client";
import { canManageSettings } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { isReportDayClosed } from "@/lib/transaction-manual.server";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";

export type TransactionDateResolution =
  | { ok: true; date: Date; dateKey: string; isBackdate: boolean }
  | { ok: false; error: string; status: number };

export function resolveTransactionDateInput(
  role: UserRole,
  raw?: string | null
): TransactionDateResolution {
  const todayKey = mskDateKey();
  const dateKey = raw?.trim().slice(0, 10) || todayKey;

  if (dateKey > todayKey) {
    return { ok: false, error: "Дата операции не может быть в будущем", status: 400 };
  }

  const isBackdate = dateKey !== todayKey;
  if (isBackdate && !canManageSettings(role)) {
    return {
      ok: false,
      error: "Только владелец или управляющий может указать дату операции",
      status: 403,
    };
  }

  return {
    ok: true,
    date: parseMskDateKey(dateKey),
    dateKey,
    isBackdate,
  };
}

export async function assertPaymentOperationAllowed(
  hotelId: string,
  role: UserRole,
  operationDateKey: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const todayKey = mskDateKey();
  if (operationDateKey !== todayKey && canManageSettings(role)) {
    return { ok: true };
  }

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) {
    return { ok: false, error: payLock.error, status: payLock.status };
  }

  if (await isReportDayClosed(hotelId, operationDateKey)) {
    return { ok: false, error: "Сутки закрыты отчётом", status: 403 };
  }

  return { ok: true };
}
