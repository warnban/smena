import "server-only";

import type { Prisma } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { getAccessibleHotelIds } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const REFUND_SEARCH_STATUSES = ["checkedin", "checkedout", "confirmed"] as const;

export function refundSearchStatusFilter(): Prisma.BookingWhereInput {
  return { status: { in: [...REFUND_SEARCH_STATUSES] } };
}

/** Поиск по ФИО (бронь и профиль гостя), телефону и номеру комнаты. */
export function buildRefundGuestSearchWhere(q: string): Prisma.BookingWhereInput {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!tokens.length) return {};

  return {
    AND: tokens.map((token) => {
      const digits = token.replace(/\D/g, "");
      const or: Prisma.BookingWhereInput[] = [
        { guestName: { contains: token, mode: "insensitive" } },
        { guest: { name: { contains: token, mode: "insensitive" } } },
        { guest: { lastName: { contains: token, mode: "insensitive" } } },
        { guest: { firstName: { contains: token, mode: "insensitive" } } },
        { guest: { middleName: { contains: token, mode: "insensitive" } } },
        { room: { number: { contains: token, mode: "insensitive" } } },
      ];
      if (digits.length >= 3) {
        or.push({ guest: { phone: { contains: digits } } });
      }
      return { OR: or };
    }),
  };
}

export function refundHasPrepaymentFilter(): Prisma.BookingWhereInput {
  return {
    OR: [
      { paid: { gt: 0 } },
      {
        transactions: {
          some: {
            type: "payment",
            category: "accommodation",
            cancelledAt: null,
            amount: { gt: 0 },
          },
        },
      },
    ],
  };
}

export async function resolveRefundSearchHotelIds(
  session: SessionPayload,
  hotelId: string | null
): Promise<{ ok: true; hotelIds: string[] } | { ok: false; status: number; error: string }> {
  if (hotelId && hotelId !== "all") {
    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };
    return { ok: true, hotelIds: [hotelId] };
  }

  const accessible = await getAccessibleHotelIds(session);
  if (accessible === "all") {
    const hotels = await prisma.hotel.findMany({
      where: { seatId: session.seatId },
      select: { id: true },
    });
    return { ok: true, hotelIds: hotels.map((h) => h.id) };
  }

  if (!accessible.length) {
    return { ok: false, status: 403, error: "Нет доступных отелей" };
  }

  return { ok: true, hotelIds: accessible };
}
