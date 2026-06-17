import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const channel = await prisma.channel.findFirst({
    where: { id: params.id, hotel: { seatId: auth.session.seatId } },
  });
  if (!channel) return NextResponse.json({ error: "Канал не найден" }, { status: 404 });

  const bookingCount = await prisma.booking.count({
    where: { channelId: channel.id },
  });
  if (bookingCount > 0) {
    return NextResponse.json(
      { error: `Канал используется в ${bookingCount} бронировании(ях). Удаление невозможно.` },
      { status: 409 }
    );
  }

  await prisma.channel.delete({ where: { id: channel.id } });
  return NextResponse.json({ ok: true });
}
