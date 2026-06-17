import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    where: { hotel: { seatId: session.seatId } },
    include: { hotel: { select: { id: true } } },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const ch of channels) {
    const bookings = await prisma.booking.findMany({
      where: {
        hotelId: ch.hotelId,
        channelId: ch.id,
        createdAt: { gte: monthStart },
        status: { not: "cancelled" },
      },
    });
    const revenue = bookings.reduce((s, b) => s + b.amount, 0);
    const rooms = await prisma.room.count({
      where: { hotelId: ch.hotelId, status: { in: ["available", "checkin"] } },
    });

    await prisma.channel.update({
      where: { id: ch.id },
      data: {
        bookingsMonth: bookings.length,
        revenueMonth: revenue,
        inventory: rooms,
        lastSyncMin: 0,
        status: "ok",
      },
    });
  }

  const updated = await prisma.channel.findMany({
    where: { hotel: { seatId: session.seatId } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, channels: updated });
}
