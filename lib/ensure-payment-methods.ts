import type { PaymentMethodDef } from "@/lib/payment-methods";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";
import { prisma } from "@/lib/prisma";

export async function ensurePaymentMethods(seatId: string): Promise<PaymentMethodDef[]> {
  const existing = await prisma.paymentMethodDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length) return existing;

  await prisma.paymentMethodDef.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((m) => ({ ...m, seatId, active: true })),
  });

  return prisma.paymentMethodDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
}
