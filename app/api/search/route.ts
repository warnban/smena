import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ guests: [], bookings: [], rooms: [] });
  }

  let hotelIds: string[];
  if (session.role === "owner") {
    const hotels = await prisma.hotel.findMany({ where: { seatId: session.seatId }, select: { id: true } });
    hotelIds = hotels.map((h) => h.id);
  } else {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
      include: { hotels: true },
    });
    hotelIds = staff?.hotels.map((h) => h.hotelId) ?? [];
  }

  const [guests, bookings, rooms] = await Promise.all([
    prisma.guest.findMany({
      where: {
        seatId: session.seatId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, name: true, phone: true, isForeigner: true },
    }),
    prisma.booking.findMany({
      where: {
        hotelId: { in: hotelIds },
        OR: [
          { guestName: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, guestName: true, status: true, checkIn: true, checkOut: true },
      orderBy: { checkIn: "desc" },
    }),
    prisma.room.findMany({
      where: {
        hotelId: { in: hotelIds },
        OR: [
          { number: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, number: true, category: true, status: true, hotelId: true },
    }),
  ]);

  return NextResponse.json({ guests, bookings, rooms });
}
