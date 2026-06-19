import type { Bed, Booking, Room } from "@/lib/types";
import { calcOccupancyPctByDateKey } from "@/lib/occupancy-capacity";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";

export function buildOccupancyMap(
  bookings: Booking[],
  rooms: Room[],
  dateKeys: string[],
  dailyReportOccupancy: Record<string, number> = {},
  beds: Bed[] = []
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of dateKeys) {
    out[key] =
      dailyReportOccupancy[key] ??
      calcOccupancyPctByDateKey(bookings, rooms, beds, key);
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
