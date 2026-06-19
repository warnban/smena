import type { BookingSourceDef } from "@/lib/types";
import { DEFAULT_BOOKING_SOURCES } from "@/lib/booking-sources";
import { prisma } from "@/lib/prisma";

export async function ensureBookingSources(seatId: string): Promise<BookingSourceDef[]> {
  const existing = await prisma.bookingSourceDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length) return existing;

  await prisma.bookingSourceDef.createMany({
    data: DEFAULT_BOOKING_SOURCES.map((s) => ({ ...s, seatId, active: true })),
  });

  return prisma.bookingSourceDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
}
