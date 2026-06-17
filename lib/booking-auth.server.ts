import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { canWriteHotelOps } from "@/lib/permissions";

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { hotel: true, room: true, guest: true },
  });
}

export async function assertBookingWrite(session: SessionPayload | null, bookingId: string) {
  if (!session?.seatId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canWriteHotelOps(session.role)) {
    return { ok: false as const, status: 403, error: "Недостаточно прав" };
  }

  const booking = await loadBooking(bookingId);
  if (!booking || booking.hotel.seatId !== session.seatId) {
    return { ok: false as const, status: 404, error: "Бронь не найдена" };
  }

  if (session.role !== "owner") {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
      include: { hotels: true },
    });
    const allowed = staff?.hotels.some((h) => h.hotelId === booking.hotelId);
    if (!allowed) {
      return { ok: false as const, status: 403, error: "Нет доступа к отелю" };
    }
  }

  return { ok: true as const, session, booking };
}

export type AssertBookingWriteResult = Awaited<ReturnType<typeof assertBookingWrite>>;
