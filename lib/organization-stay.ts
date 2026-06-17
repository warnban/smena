import { prisma } from "@/lib/prisma";
import { mskNightDiff } from "@/lib/msk-time";
import { startOfDay } from "@/lib/format";

export function parseStayDate(value: string | Date): Date {
  const d = new Date(value);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return startOfDay(aStart) < startOfDay(bEnd) && startOfDay(bStart) < startOfDay(aEnd);
}

export function roomStayNights(checkIn: Date, checkOut: Date): number {
  return Math.max(1, mskNightDiff(checkIn, checkOut));
}

export function calcRoomAmount(price: number, checkIn: Date, checkOut: Date): number {
  return price * roomStayNights(checkIn, checkOut);
}

export function calcStayRoomsAmount(
  rooms: { price: number; checkIn: Date; checkOut: Date; status: string; checkedOutAt?: Date | null }[]
): number {
  return rooms.reduce((sum, r) => {
    const end = r.status === "checked_out" && r.checkedOutAt ? r.checkedOutAt : r.checkOut;
    return sum + calcRoomAmount(r.price, r.checkIn, end);
  }, 0);
}

export async function recalcOrganizationStayAmount(stayId: string): Promise<number> {
  const stay = await prisma.organizationStay.findUnique({
    where: { id: stayId },
    include: { rooms: { include: { room: true } } },
  });
  if (!stay) return 0;

  const amount = calcStayRoomsAmount(
    stay.rooms.map((sr) => ({
      price: sr.room.price,
      checkIn: sr.checkIn,
      checkOut: sr.checkOut,
      status: sr.status,
      checkedOutAt: sr.checkedOutAt,
    }))
  );

  await prisma.organizationStay.update({
    where: { id: stayId },
    data: { amount },
  });

  return amount;
}

export async function assertRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeStayRoomId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { in: ["new", "confirmed", "checkedin"] },
    },
    select: { checkIn: true, checkOut: true, guestName: true },
  });

  for (const b of bookings) {
    if (datesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) {
      return { ok: false, error: `Номер занят бронированием: ${b.guestName}` };
    }
  }

  const orgRooms = await prisma.organizationStayRoom.findMany({
    where: {
      roomId,
      status: "active",
      ...(excludeStayRoomId ? { id: { not: excludeStayRoomId } } : {}),
    },
    select: {
      checkIn: true,
      checkOut: true,
      organizationStay: { select: { organization: { select: { name: true } } } },
    },
  });

  for (const sr of orgRooms) {
    if (datesOverlap(checkIn, checkOut, sr.checkIn, sr.checkOut)) {
      return { ok: false, error: `Номер занят организацией: ${sr.organizationStay.organization.name}` };
    }
  }

  return { ok: true };
}

export function shouldOccupyRoom(checkIn: Date): boolean {
  return startOfDay(checkIn) <= startOfDay(new Date());
}
