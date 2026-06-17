import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = req.nextUrl;
  const hotelId = searchParams.get("hotelId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const roomId = searchParams.get("roomId");
  const guestId = searchParams.get("guestId");
  const guestGenderParam = searchParams.get("guestGender") as "M" | "F" | null;

  if (!hotelId || !checkIn || !checkOut) {
    return NextResponse.json({ error: "Укажите hotelId, checkIn, checkOut" }, { status: 400 });
  }

  const check = await assertHotelWrite(session, hotelId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  let guestGender = guestGenderParam ?? null;
  if (guestId && !guestGender && session?.seatId) {
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, seatId: session.seatId },
      select: { gender: true },
    });
    guestGender = guest?.gender ?? null;
  }

  const { rooms, nights } = await findAvailableRooms({
    hotelId,
    checkIn,
    checkOut,
    guestGender,
  });

  const filtered = roomId ? rooms.filter((r) => r.roomId === roomId) : rooms;

  return NextResponse.json({ slots: filtered, nights });
}
