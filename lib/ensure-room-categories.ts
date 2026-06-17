import { prisma } from "@/lib/prisma";
import { DEFAULT_ROOM_CATEGORIES, type RoomCategoryDef } from "@/lib/room-categories";

export async function ensureRoomCategories(seatId: string): Promise<RoomCategoryDef[]> {
  const existing = await prisma.roomCategoryDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length) return existing;

  await prisma.roomCategoryDef.createMany({
    data: DEFAULT_ROOM_CATEGORIES.map((c) => ({ ...c, seatId })),
  });

  return prisma.roomCategoryDef.findMany({
    where: { seatId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function isValidCategoryCode(seatId: string, code: string): Promise<boolean> {
  const cats = await ensureRoomCategories(seatId);
  return cats.some((c) => c.active && c.code === code);
}

export async function defaultCategoryCode(seatId: string): Promise<string> {
  const cats = await ensureRoomCategories(seatId);
  const active = cats.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return active[0]?.code ?? "Double";
}
