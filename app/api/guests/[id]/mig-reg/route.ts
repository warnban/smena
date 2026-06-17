import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const notifNumber = (body.notifNumber as string | undefined)?.trim() ?? "";

  const guest = await prisma.guest.findFirst({
    where: { id: params.id, seatId: session.seatId },
  });
  if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
  if (!guest.isForeigner) {
    return NextResponse.json({ error: "Миграционный учёт не требуется" }, { status: 400 });
  }

  const now = new Date();
  const submittedAt = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: {
      migRegStatus: "submitted",
      migRegSubmittedAt: submittedAt,
      ...(notifNumber ? { migRegNotifNumber: notifNumber } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    submittedAt,
    notifNumber: updated.migRegNotifNumber,
  });
}
