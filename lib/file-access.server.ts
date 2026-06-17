import "server-only";

import { prisma } from "@/lib/prisma";

const UUID = /^[0-9a-f-]{36}$/i;

type AccessResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function assertStorageFileAccess(
  seatId: string,
  storageKey: string
): Promise<AccessResult> {
  const key = storageKey.replace(/^\/+/, "");
  if (!key.startsWith("uploads/")) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const parts = key.split("/");
  const kind = parts[1];

  if (kind === "guests") {
    const guestId = parts[2];
    if (!guestId || !UUID.test(guestId)) {
      return { ok: false, error: "Not found", status: 404 };
    }
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, seatId },
      select: { id: true },
    });
    return guest ? { ok: true } : { ok: false, error: "Not found", status: 404 };
  }

  if (kind === "organizations") {
    const orgId = parts[2];
    if (!orgId || !UUID.test(orgId)) {
      return { ok: false, error: "Not found", status: 404 };
    }
    const org = await prisma.organization.findFirst({
      where: { id: orgId, seatId },
      select: { id: true },
    });
    return org ? { ok: true } : { ok: false, error: "Not found", status: 404 };
  }

  if (kind === "refunds") {
    const refundId = parts[2];
    if (!refundId || !UUID.test(refundId)) {
      return { ok: false, error: "Not found", status: 404 };
    }
    const refund = await prisma.refundRecord.findFirst({
      where: { id: refundId, hotel: { seatId } },
      select: { id: true },
    });
    return refund ? { ok: true } : { ok: false, error: "Not found", status: 404 };
  }

  return { ok: false, error: "Forbidden", status: 403 };
}
