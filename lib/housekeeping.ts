import type { PrismaClient } from "@prisma/client";
import type { HkTaskCategory } from "@/lib/types";
import { formatDormPlaceLabel } from "@/lib/dorm";
import { startOfDay, daysBetween } from "@/lib/housekeeping-utils";

/** Сколько часов задача остаётся в колонке «Готово» */
export const HK_DONE_VISIBLE_HOURS = 24;

export function formatHkPlaceLabel(roomNumber: string, bedLabel?: string | null): string {
  if (!bedLabel?.trim()) return roomNumber;
  return formatDormPlaceLabel(roomNumber, bedLabel);
}

export function formatHkDoneAge(completedAt: Date | string | null | undefined, updatedAt: Date | string): string {
  const d = completedAt ? new Date(completedAt) : new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "";
  const hours = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (hours < 1) return "только что";
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} д`;
}

export function isHkDoneVisible(
  completedAt: Date | string | null | undefined,
  updatedAt: Date | string,
  nowMs = Date.now()
): boolean {
  const d = completedAt ? new Date(completedAt) : new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  return nowMs - d.getTime() < HK_DONE_VISIBLE_HOURS * 3600000;
}

export const HK_CATEGORY_LABELS: Record<HkTaskCategory, string> = {
  checkout: "Выезд",
  relocation: "Переселение",
  scheduled: "Плановая уборка",
};

export const HK_CATEGORY_TYPES: Record<HkTaskCategory, string> = {
  checkout: "Уборка после выезда",
  relocation: "Уборка после переселения",
  scheduled: "Плановая уборка (7 дней)",
};

export function hkTimeNow(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export { startOfDay, daysBetween };

export type ActiveBookingRow = {
  id: string;
  hotelId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
};

async function maybeCreateScheduledTask(
  prisma: PrismaClient,
  params: {
    hotelId: string;
    roomId: string;
    bedId?: string | null;
    roomNumber: string;
    checkIn: Date;
    anchorBookingId?: string | null;
    anchorStayId?: string | null;
    anchorStayRoomId?: string | null;
  }
) {
  const today = startOfDay(new Date());
  const daysStayed = daysBetween(params.checkIn, today);
  if (daysStayed < 7) return;

  const openTask = await prisma.hkTask.findFirst({
    where: {
      roomId: params.roomId,
      ...(params.bedId ? { bedId: params.bedId } : { bedId: null }),
      category: "scheduled",
      status: { in: ["pending", "in_progress"] },
    },
  });
  if (openTask) return;

  const lastDoneWhere = params.anchorBookingId
    ? { bookingId: params.anchorBookingId, category: "scheduled" as const, status: "done" as const }
    : {
        organizationStayRoomId: params.anchorStayRoomId ?? undefined,
        category: "scheduled" as const,
        status: "done" as const,
      };

  const lastDone = await prisma.hkTask.findFirst({
    where: lastDoneWhere,
    orderBy: { createdAt: "desc" },
  });

  const anchor = lastDone ? lastDone.createdAt : params.checkIn;
  const daysSinceAnchor = daysBetween(anchor, today);
  if (daysSinceAnchor < 7) return;

  await prisma.hkTask.create({
    data: {
      hotelId: params.hotelId,
      roomId: params.roomId,
      bedId: params.bedId ?? null,
      bookingId: params.anchorBookingId ?? null,
      organizationStayId: params.anchorStayId ?? null,
      organizationStayRoomId: params.anchorStayRoomId ?? null,
      roomNumber: params.roomNumber,
      type: HK_CATEGORY_TYPES.scheduled,
      category: "scheduled",
      assignee: "—",
      priority: "normal",
      status: "pending",
      time: hkTimeNow(),
      est: "45 мин",
    },
  });
}

/** Создаёт плановые задачи: раз в 7 дней проживания, не дублируя открытые. */
export async function syncScheduledCleaning(prisma: PrismaClient, hotelIds: string[]) {
  const today = startOfDay(new Date());

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId: { in: hotelIds },
      status: "checkedin",
      checkOut: { gte: today },
    },
    select: {
      id: true,
      hotelId: true,
      roomId: true,
      bedId: true,
      checkIn: true,
      checkOut: true,
      status: true,
    },
  });

  for (const b of bookings) {
    const room = await prisma.room.findUnique({
      where: { id: b.roomId },
      select: { number: true },
    });
    if (!room) continue;

    let roomNumber = room.number;
    if (b.bedId) {
      const bed = await prisma.bed.findUnique({ where: { id: b.bedId }, select: { label: true } });
      if (bed) roomNumber = formatHkPlaceLabel(room.number, bed.label);
    }

    await maybeCreateScheduledTask(prisma, {
      hotelId: b.hotelId,
      roomId: b.roomId,
      bedId: b.bedId,
      roomNumber,
      checkIn: b.checkIn,
      anchorBookingId: b.id,
    });
  }

  const orgRooms = await prisma.organizationStayRoom.findMany({
    where: {
      status: "active",
      checkOut: { gte: today },
      organizationStay: {
        hotelId: { in: hotelIds },
        status: "active",
        organization: { skipWeeklyCleaning: false },
      },
    },
    include: {
      room: { select: { number: true } },
      organizationStay: { select: { id: true, hotelId: true } },
    },
  });

  for (const sr of orgRooms) {
    await maybeCreateScheduledTask(prisma, {
      hotelId: sr.organizationStay.hotelId,
      roomId: sr.roomId,
      roomNumber: sr.roomNumber || sr.room.number,
      checkIn: sr.checkIn,
      anchorStayId: sr.organizationStay.id,
      anchorStayRoomId: sr.id,
    });
  }
}
