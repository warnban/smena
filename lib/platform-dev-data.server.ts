import "server-only";

import { prisma } from "@/lib/prisma";
import { revenueAmount, isTransactionRecognized } from "@/lib/finance";
import type { Booking, Transaction } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/permissions";

export async function getPlatformOverview() {
  const [seatsCount, hotelsCount, usersCount, blockedCount, guestsCount, bookingsCount] =
    await Promise.all([
      prisma.seat.count(),
      prisma.hotel.count(),
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.guest.count(),
      prisma.booking.count({ where: { status: { not: "cancelled" } } }),
    ]);

  const revenue = await calcTotalPlatformRevenue();

  return {
    seatsCount,
    hotelsCount,
    usersCount,
    blockedCount,
    guestsCount,
    bookingsCount,
    totalRevenue: revenue,
  };
}

async function calcTotalPlatformRevenue(): Promise<number> {
  const [transactions, bookings] = await Promise.all([
    prisma.transaction.findMany(),
    prisma.booking.findMany({ select: { id: true, status: true, checkedOutAt: true, checkOut: true } }),
  ]);

  const bookingRows = bookings as Pick<Booking, "id" | "status" | "checkedOutAt" | "checkOut">[];
  const txRows = transactions as Transaction[];

  return txRows
    .filter((t) => isTransactionRecognized(t, bookingRows as Booking[]))
    .reduce((sum, t) => sum + revenueAmount(t), 0);
}

export async function getPlatformSeatsWithHotels() {
  const seats = await prisma.seat.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true, isBlocked: true } },
      hotels: { orderBy: { name: "asc" } },
      _count: { select: { users: true, guests: true, staff: true } },
    },
  });

  const hotelIds = seats.flatMap((s) => s.hotels.map((h) => h.id));
  const [transactions, bookings] = await Promise.all([
    prisma.transaction.findMany({ where: { hotelId: { in: hotelIds } } }),
    prisma.booking.findMany({
      where: { hotelId: { in: hotelIds } },
      select: { id: true, hotelId: true, status: true, checkedOutAt: true, checkOut: true },
    }),
  ]);

  const txRows = transactions as Transaction[];
  const bookingRows = bookings as Booking[];

  return seats.map((seat) => {
    const hotels = seat.hotels.map((hotel) => {
      const hotelTxs = txRows.filter((t) => t.hotelId === hotel.id);
      const hotelBookings = bookingRows.filter((b) => b.hotelId === hotel.id);
      const revenue = hotelTxs
        .filter((t) => isTransactionRecognized(t, hotelBookings))
        .reduce((sum, t) => sum + revenueAmount(t), 0);
      const activeBookings = hotelBookings.filter(
        (b) => b.status === "checkedin" || b.status === "confirmed" || b.status === "new"
      ).length;

      return {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        address: hotel.address,
        stars: hotel.stars,
        phone: hotel.phone,
        email: hotel.email,
        legalName: hotel.legalName,
        createdAt: hotel.createdAt.toISOString(),
        revenue,
        activeBookings,
      };
    });

    const seatRevenue = hotels.reduce((s, h) => s + h.revenue, 0);

    return {
      id: seat.id,
      name: seat.name,
      createdAt: seat.createdAt.toISOString(),
      owner: seat.owner,
      usersCount: seat._count.users,
      guestsCount: seat._count.guests,
      staffCount: seat._count.staff,
      hotelsCount: hotels.length,
      revenue: seatRevenue,
      hotels,
    };
  });
}

export async function getPlatformUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      seat: { select: { id: true, name: true } },
      ownedSeat: { select: { id: true, name: true } },
      staff: { select: { id: true, name: true, position: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] ?? u.role,
    seatId: u.seatId,
    seatName: u.seat?.name ?? u.ownedSeat?.name ?? null,
    isOwner: Boolean(u.ownedSeat),
    isBlocked: u.isBlocked,
    blockedAt: u.blockedAt?.toISOString() ?? null,
    devPasswordPlain: u.devPasswordPlain || null,
    createdAt: u.createdAt.toISOString(),
    staffName: u.staff?.name ?? null,
    staffPosition: u.staff?.position ?? null,
  }));
}
