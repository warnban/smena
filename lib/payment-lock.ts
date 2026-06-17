import { prisma } from "@/lib/prisma";
import {
  fmtMskDateTime,
  isPaymentUnlockedAfterReport,
  mskDateKey,
  mskUnlockAfterReport,
  parseMskDateKey,
} from "@/lib/msk-time";

export type PaymentLockStatus = {
  locked: boolean;
  reportDate: string | null;
  unlockAt: string | null;
  message: string | null;
};

export async function getPaymentLockStatus(hotelId: string): Promise<PaymentLockStatus> {
  const todayKey = mskDateKey();
  const report = await prisma.dailyReport.findUnique({
    where: { hotelId_date: { hotelId, date: parseMskDateKey(todayKey) } },
  });

  if (!report) {
    return { locked: false, reportDate: null, unlockAt: null, message: null };
  }

  if (isPaymentUnlockedAfterReport(todayKey)) {
    return { locked: false, reportDate: todayKey, unlockAt: null, message: null };
  }

  const unlockAt = mskUnlockAfterReport(todayKey);
  return {
    locked: true,
    reportDate: todayKey,
    unlockAt: unlockAt.toISOString(),
    message: `Операции с деньгами закрыты до ${fmtMskDateTime(unlockAt)} (МСК): оплаты, услуги, расходы, инкассация и зарплаты`,
  };
}

export async function assertPaymentsOpen(hotelId: string) {
  const status = await getPaymentLockStatus(hotelId);
  if (status.locked) {
    return {
      ok: false as const,
      status: 403,
      error: status.message ?? "Операции с деньгами закрыты до конца смены",
    };
  }
  return { ok: true as const };
}
