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

const BATCH_SIZE = 400;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function sumBatchedDelete(
  ids: string[],
  run: (batch: string[]) => Promise<{ count: number }>
): Promise<number> {
  let total = 0;
  for (const batch of chunks(ids, BATCH_SIZE)) {
    const r = await run(batch);
    total += r.count;
  }
  return total;
}

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
  const guestIds = Array.from(guestIdSet);

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

  if (transactionIds.length) {
    await sumBatchedDelete(transactionIds, (batch) =>
      prisma.refundRecord.deleteMany({ where: { transactionId: { in: batch } } })
    );
    await sumBatchedDelete(transactionIds, (batch) =>
      prisma.salaryLedgerEntry.updateMany({
        where: { transactionId: { in: batch } },
        data: { transactionId: null },
      })
    );
    deletedTransactions = await sumBatchedDelete(transactionIds, (batch) =>
      prisma.transaction.deleteMany({ where: { id: { in: batch } } })
    );
  }

  if (bookingIds.length) {
    await sumBatchedDelete(bookingIds, (batch) =>
      prisma.refundRecord.deleteMany({ where: { bookingId: { in: batch } } })
    );
    await sumBatchedDelete(bookingIds, (batch) =>
      prisma.serviceSale.deleteMany({ where: { bookingId: { in: batch } } })
    );
    await sumBatchedDelete(bookingIds, (batch) =>
      prisma.hkTask.updateMany({
        where: { bookingId: { in: batch } },
        data: { bookingId: null },
      })
    );
    deletedBookings = await sumBatchedDelete(bookingIds, (batch) =>
      prisma.booking.deleteMany({ where: { id: { in: batch } } })
    );
  }

  if (guestIds.length) {
    deletedGuests = await sumBatchedDelete(guestIds, (batch) =>
      prisma.guest.deleteMany({ where: { id: { in: batch }, seatId } })
    );
  }

  const mapResult = await prisma.botMigrationMap.deleteMany({ where: { seatId } });

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
      migrationMaps: mapResult.count,
      bedsReset: bedsReset.count,
      roomsReset: roomsReset.count,
    },
  };
}
