import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACCOMMODATION = "accommodation";

export async function cancelTransaction(
  transactionId: string,
  seatId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!transactionId?.trim()) {
    return { ok: false, error: "Не указана транзакция" };
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, hotel: { seatId } },
  });

  if (!tx) return { ok: false, error: "Транзакция не найдена" };
  if (tx.cancelledAt) return { ok: false, error: "Транзакция уже отменена" };

  const [booking, refundRecord, salaryEntry] = await Promise.all([
    tx.bookingId
      ? prisma.booking.findUnique({ where: { id: tx.bookingId } })
      : Promise.resolve(null),
    prisma.refundRecord.findUnique({ where: { transactionId: tx.id } }),
    prisma.salaryLedgerEntry.findUnique({ where: { transactionId: tx.id } }),
  ]);

  try {
    await prisma.$transaction(async (db) => {
      if (tx.type === "payment" && tx.category === ACCOMMODATION && tx.bookingId && booking) {
        await db.booking.update({
          where: { id: tx.bookingId },
          data: { paid: Math.max(0, booking.paid - tx.amount) },
        });
      }

      if (tx.type === "refund" && tx.bookingId && booking) {
        await db.booking.update({
          where: { id: tx.bookingId },
          data: { paid: Math.min(booking.amount, booking.paid + tx.amount) },
        });
        if (refundRecord) {
          await db.refundRecord.delete({ where: { id: refundRecord.id } });
        }
      }

      if (tx.type === "payment" && tx.category === ACCOMMODATION && tx.organizationStayId) {
        const stay = await db.organizationStay.findUnique({
          where: { id: tx.organizationStayId },
          include: { organization: true },
        });
        if (stay) {
          await db.organizationStay.update({
            where: { id: stay.id },
            data: { paid: Math.max(0, stay.paid - tx.amount) },
          });
          await db.organization.update({
            where: { id: stay.organizationId },
            data: { totalSpent: Math.max(0, stay.organization.totalSpent - tx.amount) },
          });
        }
      }

      if (tx.type === "service" && tx.bookingId) {
        const sale = await db.serviceSale.findFirst({
          where: {
            bookingId: tx.bookingId,
            amount: tx.amount,
            paymentMethod: tx.paymentMethod,
          },
          orderBy: { date: "desc" },
        });
        if (sale) await db.serviceSale.delete({ where: { id: sale.id } });
      }

      if (salaryEntry) {
        await db.salaryLedgerEntry.delete({ where: { id: salaryEntry.id } });
      }

      await db.transaction.update({
        where: { id: tx.id },
        data: {
          cancelledAt: new Date(),
          cancelledByUserId: userId,
        },
      });
    });
  } catch (e) {
    console.error("[cancelTransaction]", e);
    if (e instanceof Prisma.PrismaClientValidationError) {
      const msg = e.message;
      if (msg.includes("cancelledAt") || msg.includes("cancelledByUserId")) {
        return {
          ok: false,
          error:
            "Схема БД не обновлена. Выполните: npx prisma db push && npx prisma generate, затем перезапустите сервер",
        };
      }
      return { ok: false, error: "Ошибка валидации данных при отмене" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return {
        ok: false,
        error:
          "В БД нет полей отмены транзакции. Выполните: npx prisma db push, затем перезапустите сервер",
      };
    }
    if (e instanceof Error && e.message) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось отменить транзакцию" };
  }

  return { ok: true };
}
