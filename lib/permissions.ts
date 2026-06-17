import type { UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function canManageSettings(role: UserRole): boolean {
  return role === "owner" || role === "manager";
}

export async function getManagerHotelIds(session: SessionPayload): Promise<string[] | "all"> {
  if (session.role === "owner") return "all";

  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    include: { hotels: true },
  });
  return staff?.hotels.map((h) => h.hotelId) ?? [];
}

export async function assertCanManage(session: SessionPayload | null) {
  if (!session?.seatId || !canManageSettings(session.role)) {
    return { ok: false as const, status: 403, error: "Недостаточно прав" };
  }
  return { ok: true as const, session };
}

/** Владелец или управляющий с доступом к отелю (для разблокировки закрытого дня и т.п.) */
export async function assertCanManageHotel(session: SessionPayload | null, hotelId: string) {
  const base = await assertCanManage(session);
  if (!base.ok) {
    return { ok: false as const, status: base.status, error: "Разблокировать отчёт могут только владелец или управляющий" };
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, seatId: session!.seatId },
  });
  if (!hotel) {
    return { ok: false as const, status: 404, error: "Отель не найден" };
  }

  if (session!.role !== "owner") {
    const staff = await prisma.staff.findFirst({
      where: { userId: session!.userId, seatId: session!.seatId },
      include: { hotels: true },
    });
    if (!staff?.hotels.some((h) => h.hotelId === hotelId)) {
      return { ok: false as const, status: 403, error: "Нет доступа к отелю" };
    }
  }

  return { ok: true as const, session: base.session, hotel };
}

export const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Управляющий",
  admin: "Администратор",
  staff: "Горничная",
};

export const ROLE_POSITIONS: Record<string, string> = {
  manager: "Управляющий",
  admin: "Администратор",
  staff: "Горничная",
};

export function inviteRoleAllowed(creatorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === "owner") return false;
  if (creatorRole === "owner") return ["manager", "admin", "staff"].includes(targetRole);
  if (creatorRole === "manager") return ["admin", "staff"].includes(targetRole);
  return false;
}

export function canWriteHotelOps(role: UserRole): boolean {
  return role === "owner" || role === "manager" || role === "admin";
}

export async function assertSeatOps(session: SessionPayload | null) {
  if (!session?.seatId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canWriteHotelOps(session.role)) {
    return { ok: false as const, status: 403, error: "Недостаточно прав" };
  }
  return { ok: true as const, session };
}

export async function assertHotelWrite(session: SessionPayload | null, hotelId: string) {
  if (!session?.seatId) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canWriteHotelOps(session.role)) {
    return { ok: false as const, status: 403, error: "Недостаточно прав" };
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, seatId: session.seatId },
  });
  if (!hotel) {
    return { ok: false as const, status: 404, error: "Отель не найден" };
  }

  if (session.role !== "owner") {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
      include: { hotels: true },
    });
    const allowed = staff?.hotels.some((h) => h.hotelId === hotelId);
    if (!allowed) {
      return { ok: false as const, status: 403, error: "Нет доступа к отелю" };
    }
  }

  return { ok: true as const, session, hotel };
}
