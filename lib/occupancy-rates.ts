import type { Booking, Room } from "@/lib/types";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";

function countDayOccupancy(bookings: Booking[], rooms: Room[], dateKey: string): number {
  const date = parseMskDateKey(dateKey);
  const occupied = bookings.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.checkIn <= date &&
      b.checkOut > date &&
      (b.status === "checkedin" || b.status === "confirmed" || b.status === "new")
  ).length;
  return rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;
}

export function buildOccupancyMap(
  bookings: Booking[],
  rooms: Room[],
  dateKeys: string[],
  dailyReportOccupancy: Record<string, number> = {}
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of dateKeys) {
    out[key] = dailyReportOccupancy[key] ?? countDayOccupancy(bookings, rooms, key);
  }
  return out;
}

export async function loadDailyReportOccupancy(
  prisma: { dailyReport: { findMany: (args: object) => Promise<{ date: Date; occupancy: number }[]> } },
  hotelId: string,
  from: string,
  to: string
): Promise<Record<string, number>> {
  const reports = await prisma.dailyReport.findMany({
    where: {
      hotelId,
      date: { gte: parseMskDateKey(from), lte: parseMskDateKey(to) },
    },
    select: { date: true, occupancy: true },
  });
  return Object.fromEntries(reports.map((r) => [mskDateKey(r.date), r.occupancy]));
}
