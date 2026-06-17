import "server-only";

import type { BookingStatus, DormGender, RoomStatus, TxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import { ensureRoomCategories, defaultCategoryCode } from "@/lib/ensure-room-categories";
import type { BotMigrationExportV1, BotMigrationGuest } from "@/lib/migration/bot-types";
import {
  isGuestCategory,
  mapBotExpenseCategory,
  mapBotPaymentLabel,
  mapBotTransactionType,
} from "@/lib/migration/bot-payment-map";

export type ImportResult = {
  ok: true;
  created: Record<string, number>;
  skipped: Record<string, number>;
  stats: BotMigrationExportV1["stats"];
  reconciliation: {
    fromDate: string;
    botIncome: number;
    crmIncome: number;
    botExpense: number;
    crmExpense: number;
  };
};

function parseDateKey(s: string | null | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return fallback;
  return new Date(s.slice(0, 10) + "T12:00:00.000Z");
}

function splitName(fullName: string): { name: string; lastName: string; firstName: string; middleName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const lastName = parts[0] ?? "";
  const firstName = parts[1] ?? "";
  const middleName = parts.slice(2).join(" ");
  return { name: fullName.trim(), lastName, firstName, middleName };
}

function nightsBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

function resolveBookingStatus(g: BotMigrationGuest, checkOut: Date): BookingStatus {
  if (g.isLiving && g.activeStay && !g.activeStay.checkOutDate) return "checkedin";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (g.checkInDate.slice(0, 10) > today.toISOString().slice(0, 10)) return "confirmed";
  if (checkOut <= today || !g.isLiving) return "checkedout";
  return "checkedin";
}

function botBedStatus(status: string): RoomStatus {
  if (status === "occupied") return "occupied";
  if (status === "cleaning") return "cleaning";
  return "available";
}

async function getMappedId(seatId: string, entity: string, botId: string): Promise<string | null> {
  const row = await prisma.botMigrationMap.findUnique({
    where: { seatId_botEntity_botId: { seatId, botEntity: entity, botId } },
  });
  return row?.crmId ?? null;
}

async function setMappedId(seatId: string, entity: string, botId: string, crmId: string) {
  await prisma.botMigrationMap.upsert({
    where: { seatId_botEntity_botId: { seatId, botEntity: entity, botId } },
    create: { seatId, botEntity: entity, botId, crmId },
    update: { crmId },
  });
}

export async function importBotExport(
  seatId: string,
  pack: BotMigrationExportV1,
  opts?: { renameSeat?: boolean }
): Promise<ImportResult> {
  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const inc = (k: string, n = 1) => {
    created[k] = (created[k] ?? 0) + n;
  };
  const skip = (k: string, n = 1) => {
    skipped[k] = (skipped[k] ?? 0) + n;
  };

  if (opts?.renameSeat !== false) {
    await prisma.seat.update({
      where: { id: seatId },
      data: { name: pack.network.name },
    });
  }

  await ensureRoomCategories(seatId);
  const categoryCode = await defaultCategoryCode(seatId);
  await ensurePaymentMethods(seatId);

  const paymentCodeByLabel = new Map<string, string>();
  const allLabels = new Set<string>();
  for (const labels of Object.values(pack.paymentTypesByObject)) {
    for (const l of labels) allLabels.add(l);
  }
  for (const t of pack.transactions) {
    if (t.paymentType) allLabels.add(t.paymentType);
  }

  let sortOrder = 100;
  for (const label of Array.from(allLabels)) {
    const mapped = mapBotPaymentLabel(label);
    paymentCodeByLabel.set(label, mapped.code);
    const exists = await prisma.paymentMethodDef.findUnique({
      where: { seatId_code: { seatId, code: mapped.code } },
    });
    if (!exists) {
      await prisma.paymentMethodDef.create({
        data: {
          seatId,
          code: mapped.code,
          label: mapped.label,
          color: mapped.color,
          bg: mapped.bg,
          icon: mapped.icon,
          sortOrder: sortOrder++,
          active: true,
        },
      });
      inc("paymentMethods");
    }
  }

  const hotelByBotObject = new Map<string, string>();
  for (const obj of pack.objects) {
    let hotelId = await getMappedId(seatId, "object", obj.id);
    if (hotelId) {
      const exists = await prisma.hotel.findFirst({ where: { id: hotelId, seatId } });
      if (exists) {
        hotelByBotObject.set(obj.id, hotelId);
        skip("hotels");
        continue;
      }
    }
    const hotel = await prisma.hotel.create({
      data: {
        seatId,
        name: obj.name,
        city: "—",
        address: obj.description?.trim() || "—",
        legalName: obj.name,
      },
    });
    hotelId = hotel.id;
    await setMappedId(seatId, "object", obj.id, hotelId);
    hotelByBotObject.set(obj.id, hotelId);
    inc("hotels");
  }

  const roomByBotRoom = new Map<string, string>();
  for (const r of pack.rooms) {
    const hotelId = hotelByBotObject.get(r.objectId);
    if (!hotelId) continue;

    let roomId = await getMappedId(seatId, "room", r.id);
    if (roomId) {
      roomByBotRoom.set(r.id, roomId);
      skip("rooms");
      continue;
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        number: r.name,
        kind: "dorm",
        dormGender: "mixed" as DormGender,
        category: categoryCode,
        floor: 1,
        status: "available",
        price: 0,
        amenities: [],
      },
    });
    roomId = room.id;
    await setMappedId(seatId, "room", r.id, roomId);
    roomByBotRoom.set(r.id, roomId);
    inc("rooms");
  }

  const defaultDormByHotel = new Map<string, string>();
  async function defaultDormRoom(hotelId: string): Promise<string> {
    const cached = defaultDormByHotel.get(hotelId);
    if (cached) return cached;
    const room = await prisma.room.create({
      data: {
        hotelId,
        number: "Общая",
        kind: "dorm",
        dormGender: "mixed",
        category: categoryCode,
        floor: 1,
        status: "available",
        price: 0,
        amenities: [],
      },
    });
    defaultDormByHotel.set(hotelId, room.id);
    inc("rooms");
    return room.id;
  }

  const bedByBotBed = new Map<string, string>();
  for (const b of pack.beds) {
    const hotelId = hotelByBotObject.get(b.objectId);
    if (!hotelId) continue;

    let bedId = await getMappedId(seatId, "bed", b.id);
    if (bedId) {
      bedByBotBed.set(b.id, bedId);
      skip("beds");
      continue;
    }

    const roomId = b.roomId
      ? roomByBotRoom.get(b.roomId) ?? (await defaultDormRoom(hotelId))
      : await defaultDormRoom(hotelId);

    const bed = await prisma.bed.create({
      data: {
        hotelId,
        roomId,
        label: b.name,
        status: botBedStatus(b.status),
      },
    });
    bedId = bed.id;
    await setMappedId(seatId, "bed", b.id, bedId);
    bedByBotBed.set(b.id, bedId);
    inc("beds");
  }

  const bookingByBotGuest = new Map<string, string>();

  for (const g of pack.guests) {
    const hotelId = hotelByBotObject.get(g.objectId);
    if (!hotelId) continue;

    let guestId = await getMappedId(seatId, "guest", g.id);
    if (!guestId) {
      const names = splitName(g.fullName);
      const guest = await prisma.guest.create({
        data: {
          seatId,
          name: names.name,
          lastName: names.lastName,
          firstName: names.firstName,
          middleName: names.middleName,
          isForeigner: Boolean(g.isForeigner),
          migRegRequired: Boolean(g.isForeigner),
          migRegStatus: g.isForeigner ? "pending" : "not_required",
          preferences: g.notes?.trim() ?? "",
          visits: 1,
        },
      });
      guestId = guest.id;
      await setMappedId(seatId, "guest", g.id, guestId);
      inc("guests");
    } else {
      skip("guests");
    }

    let bookingId = await getMappedId(seatId, "booking", g.id);
    if (bookingId) {
      bookingByBotGuest.set(g.id, bookingId);
      skip("bookings");
      continue;
    }

    const checkIn = parseDateKey(
      g.activeStay?.checkInDate ?? g.bookingStartDate ?? g.checkInDate,
      new Date()
    );
    let checkOut = parseDateKey(
      g.activeStay?.checkOutDate ?? g.bookingEndDate ?? g.checkOutDate,
      new Date(checkIn.getTime() + 86_400_000)
    );
    if (checkOut <= checkIn) {
      checkOut = new Date(checkIn.getTime() + 86_400_000);
    }

    const nights = nightsBetween(checkIn, checkOut);
    const amount = Math.round((g.dailyRate ?? 0) * nights);

    let roomId = await defaultDormRoom(hotelId);
    let bedId: string | null = null;

    if (g.activeStay?.bedId && bedByBotBed.has(g.activeStay.bedId)) {
      bedId = bedByBotBed.get(g.activeStay.bedId)!;
      const bed = await prisma.bed.findUnique({ where: { id: bedId }, select: { roomId: true } });
      if (bed) roomId = bed.roomId;
    } else if (g.bedNumber) {
      const match = pack.beds.find((b) => b.objectId === g.objectId && b.name === g.bedNumber);
      if (match && bedByBotBed.has(match.id)) {
        bedId = bedByBotBed.get(match.id)!;
        const bed = await prisma.bed.findUnique({ where: { id: bedId }, select: { roomId: true } });
        if (bed) roomId = bed.roomId;
      }
    }

    const status = resolveBookingStatus(g, checkOut);
    const guestIncome = pack.transactions
      .filter(
        (t) =>
          t.guestPassportId === g.id &&
          t.type === "INCOME" &&
          isGuestCategory(t.category)
      )
      .reduce((s, t) => s + Math.round(t.amount), 0);

    const booking = await prisma.booking.create({
      data: {
        hotelId,
        roomId,
        bedId,
        guestId,
        guestName: g.fullName,
        checkIn,
        checkOut,
        status,
        amount: amount || guestIncome,
        paid: guestIncome,
        source: "direct",
        notes: g.notes?.trim() ? `[bot] ${g.notes.trim()}` : "",
        checkedOutAt: status === "checkedout" ? checkOut : null,
      },
    });
    bookingId = booking.id;
    await setMappedId(seatId, "booking", g.id, bookingId);
    bookingByBotGuest.set(g.id, bookingId);
    inc("bookings");

    if (bedId && status === "checkedin") {
      await prisma.bed.update({ where: { id: bedId }, data: { status: "occupied" } });
    }
  }

  const fromDate = new Date(pack.fromDate + "T00:00:00.000Z");

  for (const t of pack.transactions) {
    if (await getMappedId(seatId, "transaction", t.id)) {
      skip("transactions");
      continue;
    }

    const hotelId = hotelByBotObject.get(t.objectId);
    if (!hotelId) continue;

    const hasGuest = Boolean(t.guestPassportId);
    const txType = mapBotTransactionType(t.type, t.category, hasGuest) as TxType;
    const paymentMethod =
      paymentCodeByLabel.get(t.paymentType ?? "") ??
      mapBotPaymentLabel(t.paymentType).code;

    let category = "accommodation";
    if (txType === "expense") category = mapBotExpenseCategory(t.category);
    else if (txType === "encashment") category = "encashment";
    else if (txType === "refund") category = "accommodation";
    else if (!hasGuest && !isGuestCategory(t.category)) {
      category = mapBotExpenseCategory(t.category);
    }

    const bookingId = t.guestPassportId ? bookingByBotGuest.get(t.guestPassportId) : undefined;
    const guestName = t.payer ?? undefined;

    const row = await prisma.transaction.create({
      data: {
        hotelId,
        date: new Date(t.date),
        type: txType,
        category,
        paymentMethod,
        amount: Math.round(t.amount),
        bookingId: bookingId ?? null,
        guestName: guestName ?? null,
        note: t.comment?.trim() ? t.comment.trim() : `[bot:${t.id}]`,
        roomNumber: null,
      },
    });
    await setMappedId(seatId, "transaction", t.id, row.id);
    inc("transactions");
  }

  const hotelIds = Array.from(hotelByBotObject.values());
  const crmTx = await prisma.transaction.findMany({
    where: {
      hotelId: { in: hotelIds },
      date: { gte: fromDate },
    },
    select: { type: true, amount: true },
  });

  let crmIncome = 0;
  let crmExpense = 0;
  for (const t of crmTx) {
    if (t.type === "payment") crmIncome += t.amount;
    else if (t.type === "expense" || t.type === "encashment" || t.type === "refund") {
      crmExpense += t.amount;
    }
  }

  return {
    ok: true,
    created,
    skipped,
    stats: pack.stats,
    reconciliation: {
      fromDate: pack.fromDate,
      botIncome: pack.stats.incomeTotal,
      crmIncome,
      botExpense: pack.stats.expenseTotal,
      crmExpense,
    },
  };
}
