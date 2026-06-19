import "server-only";

import { prisma } from "@/lib/prisma";

export type PurgeImportResult = {
  ok: true;
  deleted: {
    transactions: number;
    bookings: number;
    guests: number;
    migrationMaps: number;
    bedsReset: number;
    roomsReset: number;
  };
};

export async function purgeImportedData(seatId: string): Promise<PurgeImportResult> {
  const hotels = await prisma.hotel.findMany({
    where: { seatId },
    select: { id: true },
  });
  const hotelIds = hotels.map((h) => h.id);

  const maps = await prisma.botMigrationMap.findMany({ where: { seatId } });

  const guestIdSet = new Set<string>();
  const bookingIdSet = new Set<string>();
  const transactionIdSet = new Set<string>();

  for (const row of maps) {
    if (row.botEntity === "excel_guest" || row.botEntity === "guest") {
      guestIdSet.add(row.crmId);
    } else if (row.botEntity === "excel_booking" || row.botEntity === "booking") {
      bookingIdSet.add(row.crmId);
    } else if (row.botEntity === "excel_transaction" || row.botEntity === "transaction") {
      transactionIdSet.add(row.crmId);
    }
  }

  const markerGuests = await prisma.guest.findMany({
    where: { seatId, preferences: { contains: "[excel:" } },
    select: { id: true },
  });
  markerGuests.forEach((g) => guestIdSet.add(g.id));

  const markerBookings = await prisma.booking.findMany({
    where: {
      hotelId: { in: hotelIds },
      OR: [{ notes: { contains: "[excel import]" } }, { notes: { contains: "[bot]" } }],
    },
    select: { id: true },
  });
  markerBookings.forEach((b) => bookingIdSet.add(b.id));

  if (guestIdSet.size > 0) {
    const byGuest = await prisma.booking.findMany({
      where: { guestId: { in: Array.from(guestIdSet) } },
      select: { id: true },
    });
    byGuest.forEach((b) => bookingIdSet.add(b.id));
  }

  const bookingIds = Array.from(bookingIdSet);

  const markerTransactions = await prisma.transaction.findMany({
    where: {
      hotelId: { in: hotelIds },
      OR: [
        { note: { contains: "[excel:" } },
        { note: { contains: "[bot:" } },
        ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
        ...(transactionIdSet.size
          ? [{ id: { in: Array.from(transactionIdSet) } }]
          : []),
      ],
    },
    select: { id: true },
  });

  const transactionIds = Array.from(
    new Set([...markerTransactions.map((t) => t.id), ...Array.from(transactionIdSet)])
  );

  let deletedTransactions = 0;
  let deletedBookings = 0;
  let deletedGuests = 0;
  let deletedMaps = 0;

  await prisma.$transaction(async (tx) => {
    if (transactionIds.length) {
      const refunds = await tx.refundRecord.deleteMany({
        where: { transactionId: { in: transactionIds } },
      });
      void refunds;

      const salaryUnlink = await tx.salaryLedgerEntry.updateMany({
        where: { transactionId: { in: transactionIds } },
        data: { transactionId: null },
      });
      void salaryUnlink;

      const r = await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
      deletedTransactions = r.count;
    }

    if (bookingIds.length) {
      await tx.refundRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.serviceSale.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.hkTask.updateMany({
        where: { bookingId: { in: bookingIds } },
        data: { bookingId: null },
      });
      const r = await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      deletedBookings = r.count;
    }

    if (guestIdSet.size) {
      const r = await tx.guest.deleteMany({
        where: { id: { in: Array.from(guestIdSet) }, seatId },
      });
      deletedGuests = r.count;
    }

    const mapResult = await tx.botMigrationMap.deleteMany({ where: { seatId } });
    deletedMaps = mapResult.count;
  });

  const bedsReset = await prisma.bed.updateMany({
    where: { hotelId: { in: hotelIds }, status: { not: "available" } },
    data: { status: "available" },
  });

  const roomsReset = await prisma.room.updateMany({
    where: { hotelId: { in: hotelIds }, status: { not: "available" } },
    data: { status: "available" },
  });

  return {
    ok: true,
    deleted: {
      transactions: deletedTransactions,
      bookings: deletedBookings,
      guests: deletedGuests,
      migrationMaps: deletedMaps,
      bedsReset: bedsReset.count,
      roomsReset: roomsReset.count,
    },
  };
}
