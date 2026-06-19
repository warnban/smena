import "server-only";

import type { Prisma, RoomStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncDormRoomStatus } from "@/lib/dorm.server";

type Db = Prisma.TransactionClient | typeof prisma;

async function setOrganizationRoomStatus(
  roomId: string,
  status: RoomStatus,
  db: Db
): Promise<boolean> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    include: { beds: true },
  });
  if (!room) return false;

  if (room.kind === "dorm" && room.beds.length > 0) {
    await db.bed.updateMany({
      where: { roomId },
      data: { status },
    });
    return true;
  }

  await db.room.update({ where: { id: roomId }, data: { status } });
  return false;
}

export async function occupyOrganizationRoom(roomId: string, db: Db = prisma): Promise<boolean> {
  return setOrganizationRoomStatus(roomId, "occupied", db);
}

export async function releaseOrganizationRoomToCleaning(roomId: string, db: Db = prisma): Promise<boolean> {
  return setOrganizationRoomStatus(roomId, "cleaning", db);
}

export async function releaseOrganizationRoom(roomId: string, db: Db = prisma): Promise<boolean> {
  return setOrganizationRoomStatus(roomId, "available", db);
}

export async function syncOrganizationDormRooms(roomIds: string[]): Promise<void> {
  const unique = Array.from(new Set(roomIds));
  for (const roomId of unique) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { kind: true },
    });
    if (room?.kind === "dorm") {
      await syncDormRoomStatus(roomId);
    }
  }
}
