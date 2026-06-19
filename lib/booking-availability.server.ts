import "server-only";

import type { DormGender, Gender, RoomStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcStayAmount } from "@/lib/booking-pricing";
import { guestGenderMatchesDorm } from "@/lib/dorm.server";
import { mskNightDiff, parseMskDateKey } from "@/lib/msk-time";

const BLOCKING_BOOKING_STATUSES = ["new", "checkedin", "confirmed"] as const;

export type AvailableSlotRow = {
  /** Для номера — roomId, для койки — bedId */
  id: string;
  roomId: string;
  bedId: string | null;
  kind: "private" | "dorm";
  /** Номер комнаты (родительской для койки) */
  roomLabel: string;
  /** Для номера — номер; для койки — метка койки (1/01) */
  number: string;
  category: string;
  floor: number;
  price: number;
  nights: number;
  amount: number;
  dormGender: DormGender | null;
  bedLabel: string | null;
  /** Физический статус места (уборка не блокирует бронирование) */
  placeStatus: RoomStatus;
};

async function hasBookingDateOverlap(params: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  roomId?: string;
  bedId?: string;
  excludeBookingId?: string;
}): Promise<boolean> {
  const checkInDate = parseMskDateKey(params.checkIn);
  const checkOutDate = parseMskDateKey(params.checkOut);

  const bookingWhere = {
    hotelId: params.hotelId,
    status: { in: [...BLOCKING_BOOKING_STATUSES] },
    checkIn: { lt: checkOutDate },
    checkOut: { gt: checkInDate },
    ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    ...(params.bedId ? { bedId: params.bedId } : { bedId: null, roomId: params.roomId }),
  };

  const [bookingHit, orgHit] = await Promise.all([
    prisma.booking.findFirst({ where: bookingWhere, select: { id: true } }),
    params.bedId
      ? Promise.resolve(null)
      : prisma.organizationStayRoom.findFirst({
          where: {
            roomId: params.roomId,
            status: "active",
            checkIn: { lt: checkOutDate },
            checkOut: { gt: checkInDate },
            organizationStay: { status: "active", hotelId: params.hotelId },
          },
          select: { id: true },
        }),
  ]);

  return Boolean(bookingHit || orgHit);
}

function dateRangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

export async function findAvailableRooms(params: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  category?: string;
  roomNumber?: string;
  guestGender?: Gender | null;
  kind?: "private" | "dorm";
  limit?: number;
}): Promise<{ rooms: AvailableSlotRow[]; nights: number; checkIn: string; checkOut: string }> {
  const checkIn = params.checkIn.slice(0, 10);
  const checkOut = params.checkOut.slice(0, 10);
  const nights = mskNightDiff(checkIn, checkOut);

  if (nights < 1) {
    return { rooms: [], nights: 0, checkIn, checkOut };
  }

  const checkInDate = parseMskDateKey(checkIn);
  const checkOutDate = parseMskDateKey(checkOut);

  const [rooms, bookings, orgRooms] = await Promise.all([
    prisma.room.findMany({
      where: {
        hotelId: params.hotelId,
        status: { not: "maintenance" },
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.category
          ? { category: { contains: params.category, mode: "insensitive" as const } }
          : {}),
        ...(params.roomNumber
          ? { number: { contains: params.roomNumber, mode: "insensitive" as const } }
          : {}),
      },
      include: { beds: { orderBy: { label: "asc" } } },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    prisma.booking.findMany({
      where: {
        hotelId: params.hotelId,
        status: { in: [...BLOCKING_BOOKING_STATUSES] },
      },
      select: { roomId: true, bedId: true, checkIn: true, checkOut: true },
    }),
    prisma.organizationStayRoom.findMany({
      where: {
        status: "active",
        room: { hotelId: params.hotelId },
        organizationStay: { status: "active" },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
  ]);

  const blockedPrivateRooms = new Set<string>();
  const blockedBeds = new Set<string>();

  for (const b of bookings) {
    const inKey = b.checkIn.toISOString().slice(0, 10);
    const outKey = b.checkOut.toISOString().slice(0, 10);
    if (!dateRangesOverlap(checkIn, checkOut, inKey, outKey)) continue;
    if (b.bedId) {
      blockedBeds.add(b.bedId);
    } else {
      blockedPrivateRooms.add(b.roomId);
    }
  }

  for (const r of orgRooms) {
    const inKey = r.checkIn.toISOString().slice(0, 10);
    const outKey = r.checkOut.toISOString().slice(0, 10);
    if (dateRangesOverlap(checkIn, checkOut, inKey, outKey)) {
      blockedPrivateRooms.add(r.roomId);
    }
  }

  const slots: AvailableSlotRow[] = [];

  for (const room of rooms) {
    if (room.kind === "dorm") {
      const genderKnown = params.guestGender === "M" || params.guestGender === "F";
      if (genderKnown && !guestGenderMatchesDorm(params.guestGender, room.dormGender)) continue;

      for (const bed of room.beds) {
        if (bed.status === "maintenance") continue;
        if (blockedBeds.has(bed.id)) continue;

        slots.push({
          id: bed.id,
          roomId: room.id,
          bedId: bed.id,
          kind: "dorm",
          roomLabel: room.number,
          number: bed.label,
          category: room.category,
          floor: room.floor,
          price: room.price,
          nights,
          amount: calcStayAmount({
            roomPrice: room.price,
            checkIn: checkInDate,
            checkOut: checkOutDate,
          }),
          dormGender: room.dormGender,
          bedLabel: bed.label,
          placeStatus: bed.status,
        });
      }
      continue;
    }

    if (blockedPrivateRooms.has(room.id)) continue;

    slots.push({
      id: room.id,
      roomId: room.id,
      bedId: null,
      kind: "private",
      roomLabel: room.number,
      number: room.number,
      category: room.category,
      floor: room.floor,
      price: room.price,
      nights,
      amount: calcStayAmount({
        roomPrice: room.price,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      }),
      dormGender: null,
      bedLabel: null,
      placeStatus: room.status,
    });
  }

  return {
    rooms: params.limit != null ? slots.slice(0, params.limit) : slots,
    nights,
    checkIn,
    checkOut,
  };
}

export async function resolveRoomForBooking(params: {
  hotelId: string;
  seatId: string;
  checkIn: string;
  checkOut: string;
  roomId?: string;
  bedId?: string;
  roomNumber?: string;
  anyAvailable?: boolean;
  category?: string;
  guestGender?: Gender | null;
  guestId?: string;
}): Promise<
  | {
      ok: true;
      room: { id: string; number: string; price: number; category: string; kind: string };
      bedId: string | null;
      bedLabel: string | null;
      nights: number;
      autoPicked: boolean;
    }
  | { ok: false; error: string }
> {
  const checkIn = params.checkIn.slice(0, 10);
  const checkOut = params.checkOut.slice(0, 10);

  if (mskNightDiff(checkIn, checkOut) < 1) {
    return { ok: false, error: "Дата выезда должна быть позже даты заезда" };
  }

  let guestGender = params.guestGender ?? null;
  if (params.guestId && !guestGender) {
    const guest = await prisma.guest.findFirst({
      where: { id: params.guestId, seatId: params.seatId },
      select: { gender: true },
    });
    guestGender = guest?.gender ?? null;
  }

  const { rooms: available, nights } = await findAvailableRooms({
    hotelId: params.hotelId,
    checkIn,
    checkOut,
    category: params.category,
    roomNumber: params.roomNumber,
    guestGender,
    limit: 50,
  });

  if (params.bedId) {
    const bed = await prisma.bed.findFirst({
      where: {
        id: params.bedId,
        room: { hotelId: params.hotelId, hotel: { seatId: params.seatId } },
      },
      include: { room: true },
    });
    if (!bed) return { ok: false, error: "Койко-место не найдено" };
    if (bed.status === "maintenance" || bed.room.status === "maintenance") {
      return { ok: false, error: "Койко-место на ремонте" };
    }
    if (!guestGenderMatchesDorm(guestGender, bed.room.dormGender)) {
      return {
        ok: false,
        error: `Комната ${bed.room.number} — ${bed.room.dormGender === "male" ? "мужская" : "женская"}, пол гостя не подходит`,
      };
    }
    if (await hasBookingDateOverlap({ hotelId: params.hotelId, checkIn, checkOut, bedId: bed.id })) {
      return { ok: false, error: "Койко-место занято на выбранные даты" };
    }
    return {
      ok: true,
      room: bed.room,
      bedId: bed.id,
      bedLabel: bed.label,
      nights,
      autoPicked: false,
    };
  }

  if (params.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: params.roomId, hotelId: params.hotelId, hotel: { seatId: params.seatId } },
      include: { beds: true },
    });
    if (!room) return { ok: false, error: "Номер не найден" };

    if (room.status === "maintenance") {
      return { ok: false, error: `Номер ${room.number} на ремонте` };
    }

    if (room.kind === "dorm") {
      if (!guestGenderMatchesDorm(guestGender, room.dormGender)) {
        return {
          ok: false,
          error: `Комната ${room.number} — ${room.dormGender === "male" ? "мужская" : "женская"}, пол гостя не подходит`,
        };
      }
      const slot = available.find((s) => s.roomId === room.id);
      if (!slot) {
        return { ok: false, error: `Нет свободных мест в комнате ${room.number} на ${checkIn} — ${checkOut}` };
      }
      return {
        ok: true,
        room,
        bedId: slot.bedId,
        bedLabel: slot.bedLabel,
        nights,
        autoPicked: true,
      };
    }

    if (await hasBookingDateOverlap({ hotelId: params.hotelId, checkIn, checkOut, roomId: room.id })) {
      return { ok: false, error: `Номер ${room.number} занят на ${checkIn} — ${checkOut}` };
    }
    return { ok: true, room, bedId: null, bedLabel: null, nights, autoPicked: false };
  }

  if (params.roomNumber?.trim()) {
    const q = params.roomNumber.trim().toLowerCase();
    const match =
      available.find((s) => s.bedId && s.number.toLowerCase() === q) ??
      available.find((s) => s.bedId && s.number.toLowerCase().includes(q)) ??
      available.find((s) => !s.bedId && s.roomLabel.toLowerCase() === q) ??
      available.find((s) => !s.bedId && s.roomLabel.toLowerCase().includes(q)) ??
      available.find((s) => s.number.toLowerCase() === q) ??
      available.find((s) => s.number.toLowerCase().includes(q));
    if (!match) {
      return { ok: false, error: `«${params.roomNumber}» недоступно на ${checkIn} — ${checkOut}` };
    }
    const room = await prisma.room.findFirst({ where: { id: match.roomId } });
    if (!room) return { ok: false, error: "Номер не найден" };
    return {
      ok: true,
      room,
      bedId: match.bedId,
      bedLabel: match.bedLabel,
      nights,
      autoPicked: false,
    };
  }

  if (params.anyAvailable !== false) {
    if (!available.length) {
      return { ok: false, error: `Нет свободных мест на ${checkIn} — ${checkOut}` };
    }
    const pick = available[0]!;
    const room = await prisma.room.findFirst({ where: { id: pick.roomId } });
    if (!room) return { ok: false, error: "Номер не найден" };
    return {
      ok: true,
      room,
      bedId: pick.bedId,
      bedLabel: pick.bedLabel,
      nights,
      autoPicked: true,
    };
  }

  return { ok: false, error: "Укажите номер/койку или попросите подобрать любое свободное место" };
}
