import type { Bed, Booking, Room, RoomStatus } from "@/lib/types";
import { parseMskDateKey } from "@/lib/msk-time";

const LIVE_OCCUPIED_STATUSES: RoomStatus[] = ["occupied", "checkin", "checkout"];

function isLiveOccupied(status: RoomStatus): boolean {
  return LIVE_OCCUPIED_STATUSES.includes(status);
}

function bedsInRoom(roomId: string, beds: Bed[]): number {
  return beds.filter((b) => b.roomId === roomId).length;
}

/** Продаваемые единицы: отдельный номер = 1, общая комната = число коек. */
export function sellableUnits(rooms: Room[], beds: Bed[] = []): number {
  return rooms.reduce((sum, room) => {
    if (room.kind === "dorm") {
      const count = bedsInRoom(room.id, beds);
      return sum + (count > 0 ? count : 0);
    }
    return sum + 1;
  }, 0);
}

export function isActiveBookingOnDate(booking: Booking, date: Date): boolean {
  return (
    booking.status !== "cancelled" &&
    booking.checkIn <= date &&
    booking.checkOut > date &&
    (booking.status === "checkedin" ||
      booking.status === "confirmed" ||
      booking.status === "new")
  );
}

/** Занятые единицы на дату: каждая активная бронь = 1 место (номер или койка). */
export function countOccupiedUnits(bookings: Booking[], date: Date): number {
  return bookings.filter((b) => isActiveBookingOnDate(b, date)).length;
}

export function calcOccupancyPct(
  bookings: Booking[],
  rooms: Room[],
  beds: Bed[],
  date: Date
): number {
  const capacity = sellableUnits(rooms, beds);
  if (capacity <= 0) return 0;
  const occupied = countOccupiedUnits(bookings, date);
  return Math.round((occupied / capacity) * 100);
}

export function calcOccupancyPctByDateKey(
  bookings: Booking[],
  rooms: Room[],
  beds: Bed[],
  dateKey: string
): number {
  return calcOccupancyPct(bookings, rooms, beds, parseMskDateKey(dateKey));
}

export function occupancySnapshot(
  bookings: Booking[],
  rooms: Room[],
  beds: Bed[],
  date: Date = new Date()
): { occupied: number; capacity: number; pct: number } {
  const capacity = sellableUnits(rooms, beds);
  const occupied = countOccupiedUnits(bookings, date);
  const pct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  return { occupied, capacity, pct };
}

/** Занятые единицы «прямо сейчас» по статусам номеров и коек. */
export function countLiveOccupiedUnits(rooms: Room[], beds: Bed[]): number {
  let occupied = 0;
  for (const room of rooms) {
    if (room.kind === "dorm") {
      occupied += beds.filter(
        (b) => b.roomId === room.id && isLiveOccupied(b.status)
      ).length;
    } else if (isLiveOccupied(room.status)) {
      occupied += 1;
    }
  }
  return occupied;
}

export function liveOccupancySnapshot(
  rooms: Room[],
  beds: Bed[]
): { occupied: number; capacity: number; pct: number } {
  const capacity = sellableUnits(rooms, beds);
  const occupied = countLiveOccupiedUnits(rooms, beds);
  const pct = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
  return { occupied, capacity, pct };
}

export function occupancyCapacityLabel(occupied: number, capacity: number): string {
  return `${occupied}/${capacity} мест`;
}
