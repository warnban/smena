import "server-only";

import type { BookingStatus, TxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isGuestCategory,
  mapBotExpenseCategory,
  mapBotPaymentLabel,
  mapBotTransactionType,
} from "@/lib/migration/bot-payment-map";
import {
  buildProfileAliasMap,
  canonicalProfileId,
  parseExcelBuffer,
  parseRuDate,
  parseRuDateKey,
  parseStayPeriod,
  splitName,
  txDedupKey,
} from "@/lib/migration/excel-parse";
import {
  buildCrmPlaceCatalog,
  matchExcelPlaces,
  matchHotelByName,
} from "@/lib/migration/excel-place-match";
import type {
  ExcelGuestRow,
  ExcelImportResult,
  ExcelPreviewResult,
  ExcelWorkbookData,
  PlaceMatch,
} from "@/lib/migration/excel-types";

function aitunnelConfigured(): boolean {
  return Boolean(process.env.AITUNNEL_API_KEY?.trim());
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

type HotelMap = Map<string, string>;

async function resolveHotels(
  seatId: string,
  data: ExcelWorkbookData
): Promise<{
  hotelByExcelName: HotelMap;
  hotels: ExcelPreviewResult["hotels"];
  unmatchedHotels: string[];
}> {
  const crmHotels = await prisma.hotel.findMany({
    where: { seatId },
    select: { id: true, name: true },
  });
  const hotelByExcelName: HotelMap = new Map();
  const hotels: ExcelPreviewResult["hotels"] = [];
  const unmatchedHotels: string[] = [];

  for (const excelName of data.hotelNames) {
    const matched = matchHotelByName(excelName, crmHotels);
    hotels.push({
      excelName,
      hotelId: matched?.id ?? null,
      crmName: matched?.name ?? null,
    });
    if (matched) hotelByExcelName.set(excelName, matched.id);
    else unmatchedHotels.push(excelName);
  }
  return { hotelByExcelName, hotels, unmatchedHotels };
}

async function resolvePlaceMatches(
  seatId: string,
  data: ExcelWorkbookData,
  hotelByExcelName: HotelMap
): Promise<PlaceMatch[]> {
  const all: PlaceMatch[] = [];
  for (const [excelHotel, hotelId] of Array.from(hotelByExcelName.entries())) {
    const places = data.guestRows
      .filter((r) => r.hotelName === excelHotel && r.place)
      .map((r) => r.place);
    const [rooms, beds] = await Promise.all([
      prisma.room.findMany({ where: { hotelId } }),
      prisma.bed.findMany({ where: { hotelId } }),
    ]);
    const catalog = buildCrmPlaceCatalog(rooms, beds);
    const matches = await matchExcelPlaces(
      hotelId,
      places,
      catalog,
      aitunnelConfigured()
    );
    all.push(...matches);
  }
  return all;
}

function placeLookup(matches: PlaceMatch[]): Map<string, PlaceMatch> {
  const map = new Map<string, PlaceMatch>();
  for (const m of matches) {
    map.set(`${m.hotelId}|${m.excelPlace}`, m);
  }
  return map;
}

function computePreviewStats(
  data: ExcelWorkbookData,
  aliasMap: Map<string, string>
): ExcelPreviewResult["stats"] {
  const guestIds = new Set<string>();
  let incomeTotal = 0;
  let zeroPayments = 0;
  let livingGuests = 0;

  for (const row of data.guestRows) {
    const pid = canonicalProfileId(row.profileIds, aliasMap);
    if (pid) guestIds.add(pid);
    incomeTotal += row.amount;
    if (row.amount === 0) zeroPayments++;
    if (/н\.в\./i.test(row.stayPeriod)) livingGuests++;
  }

  let expenseTotal = 0;
  for (const row of data.otherRows) {
    if (row.type === "EXPENSE") expenseTotal += row.amount;
    else if (row.type === "INCOME") incomeTotal += row.amount;
  }

  const payDates = data.guestRows
    .map((r) => parseRuDateKey(r.payDate))
    .filter(Boolean) as string[];
  payDates.sort();

  return {
    guestPayments: data.guestRows.length,
    otherTransactions: data.otherRows.length,
    uniqueGuests: guestIds.size,
    duplicateGroups: data.dupRows.length,
    incomeTotal,
    expenseTotal,
    zeroPayments,
    livingGuests,
  };
}

export async function previewExcelImport(
  seatId: string,
  buffer: Buffer
): Promise<ExcelPreviewResult> {
  const data = parseExcelBuffer(buffer);
  const aliasMap = buildProfileAliasMap(data.dupRows);
  const { hotelByExcelName, hotels, unmatchedHotels } = await resolveHotels(seatId, data);
  const placeMatches = await resolvePlaceMatches(seatId, data, hotelByExcelName);
  const unmatchedPlaces = placeMatches
    .filter((m) => m.method === "unmatched")
    .map((m) => m.excelPlace);

  const paymentMethods = Array.from(
    new Set([
      ...data.guestRows.map((r) => r.paymentMethod).filter(Boolean),
      ...data.otherRows.map((r) => r.paymentMethod).filter(Boolean),
    ])
  );

  const payDates = data.guestRows
    .map((r) => parseRuDateKey(r.payDate))
    .filter(Boolean) as string[];
  payDates.sort();

  return {
    hotels,
    stats: computePreviewStats(data, aliasMap),
    placeMatches,
    unmatchedPlaces: Array.from(new Set(unmatchedPlaces)),
    unmatchedHotels,
    paymentMethods,
    dateRange:
      payDates.length > 0
        ? { from: payDates[0]!, to: payDates[payDates.length - 1]! }
        : null,
  };
}

type GuestAggregate = {
  profileId: string;
  fullName: string;
  hotelId: string;
  place: string;
  checkIn: Date;
  checkOut: Date;
  isLiving: boolean;
  paid: number;
  amount: number;
};

function aggregateGuests(
  rows: ExcelGuestRow[],
  hotelByExcelName: HotelMap,
  aliasMap: Map<string, string>
): GuestAggregate[] {
  const map = new Map<string, GuestAggregate>();

  for (const row of rows) {
    const hotelId = hotelByExcelName.get(row.hotelName);
    const profileId = canonicalProfileId(row.profileIds, aliasMap);
    if (!hotelId || !profileId || !row.fullName) continue;

    const stay = parseStayPeriod(row.stayPeriod);
    const key = `${hotelId}:${profileId}`;
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        profileId,
        fullName: row.fullName,
        hotelId,
        place: row.place,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        isLiving: stay.isLiving,
        paid: row.amount,
        amount: row.amount,
      });
      continue;
    }

    if (stay.checkIn < prev.checkIn) prev.checkIn = stay.checkIn;
    if (stay.isLiving || stay.checkOut > prev.checkOut) {
      prev.checkOut = stay.checkOut;
      prev.isLiving = prev.isLiving || stay.isLiving;
      if (row.place) prev.place = row.place;
    }
    prev.paid += row.amount;
    prev.amount = Math.max(prev.amount, prev.paid);
  }

  return Array.from(map.values());
}

export async function importExcelWorkbook(
  seatId: string,
  buffer: Buffer
): Promise<ExcelImportResult> {
  const data = parseExcelBuffer(buffer);
  const aliasMap = buildProfileAliasMap(data.dupRows);
  const { hotelByExcelName, unmatchedHotels } = await resolveHotels(seatId, data);
  const placeMatches = await resolvePlaceMatches(seatId, data, hotelByExcelName);
  const placeByKey = placeLookup(placeMatches);
  const warnings: string[] = [];

  if (unmatchedHotels.length) {
    warnings.push(`Не сопоставлены отели: ${unmatchedHotels.join(", ")}`);
  }

  const unmatchedPlaces = placeMatches.filter((m) => m.method === "unmatched");
  if (unmatchedPlaces.length) {
    warnings.push(
      `Не сопоставлено мест: ${unmatchedPlaces.length} (${unmatchedPlaces
        .slice(0, 8)
        .map((p) => p.excelPlace)
        .join(", ")}${unmatchedPlaces.length > 8 ? "…" : ""})`
    );
  }

  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const inc = (k: string, n = 1) => {
    created[k] = (created[k] ?? 0) + n;
  };
  const skip = (k: string, n = 1) => {
    skipped[k] = (skipped[k] ?? 0) + n;
  };

  const paymentCodeByLabel = new Map<string, string>();
  const allPmLabels = new Set<string>();
  for (const r of [...data.guestRows, ...data.otherRows]) {
    if (r.paymentMethod) allPmLabels.add(r.paymentMethod);
  }
  let sortOrder = 200;
  for (const label of Array.from(allPmLabels)) {
    const mapped = mapBotPaymentLabel(label);
    paymentCodeByLabel.set(label, mapped.code);
    const exists = await prisma.paymentMethodDef.findUnique({
      where: { seatId_code: { seatId, code: mapped.code } },
    });
    if (!exists && mapped.isNew) {
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

  const aggregates = aggregateGuests(data.guestRows, hotelByExcelName, aliasMap);
  const bookingByKey = new Map<string, string>();

  for (const agg of aggregates) {
    let guestId = await getMappedId(seatId, "excel_guest", agg.profileId);
    if (!guestId) {
      const names = splitName(agg.fullName);
      const guest = await prisma.guest.create({
        data: {
          seatId,
          name: names.name,
          lastName: names.lastName,
          firstName: names.firstName,
          middleName: names.middleName,
          visits: 1,
          preferences: `[excel:${agg.profileId}]`,
        },
      });
      guestId = guest.id;
      await setMappedId(seatId, "excel_guest", agg.profileId, guestId);
      inc("guests");
    } else {
      skip("guests");
    }

    const bookingKey = `${agg.hotelId}:${agg.profileId}`;
    let bookingId = await getMappedId(seatId, "excel_booking", bookingKey);
    if (bookingId) {
      bookingByKey.set(bookingKey, bookingId);
      skip("bookings");
      continue;
    }

    const placeMatch = placeByKey.get(`${agg.hotelId}|${agg.place}`);
    let roomId = placeMatch?.roomId;
    let bedId = placeMatch?.bedId ?? null;

    if (!roomId) {
      const fallback = await prisma.room.findFirst({
        where: { hotelId: agg.hotelId },
        orderBy: { number: "asc" },
      });
      if (!fallback) continue;
      roomId = fallback.id;
      warnings.push(`Гость ${agg.fullName}: место «${agg.place}» не найдено, назначен номер ${fallback.number}`);
    }

    const status: BookingStatus = agg.isLiving ? "checkedin" : "checkedout";

    const booking = await prisma.booking.create({
      data: {
        hotelId: agg.hotelId,
        roomId,
        bedId,
        guestId,
        guestName: agg.fullName,
        checkIn: agg.checkIn,
        checkOut: agg.checkOut,
        status,
        amount: agg.amount,
        paid: 0,
        source: "direct",
        notes: `[excel import]`,
        checkedOutAt: status === "checkedout" ? agg.checkOut : null,
      },
    });
    bookingId = booking.id;
    await setMappedId(seatId, "excel_booking", bookingKey, bookingId);
    bookingByKey.set(bookingKey, bookingId);
    inc("bookings");

    if (bedId && status === "checkedin") {
      await prisma.bed.update({ where: { id: bedId }, data: { status: "occupied" } });
    }
  }

  for (const row of data.guestRows) {
    const hotelId = hotelByExcelName.get(row.hotelName);
    const profileId = canonicalProfileId(row.profileIds, aliasMap);
    if (!hotelId || !profileId) continue;

    const txKey = txDedupKey([
      "guest",
      hotelId,
      profileId,
      row.payDate,
      row.amount,
      row.payPeriod,
      row.paymentMethod,
    ]);
    if (await getMappedId(seatId, "excel_transaction", txKey)) {
      skip("transactions");
      continue;
    }

    const bookingId = bookingByKey.get(`${hotelId}:${profileId}`);
    const payDate = parseRuDate(row.payDate) ?? new Date();
    const pmCode =
      paymentCodeByLabel.get(row.paymentMethod) ?? mapBotPaymentLabel(row.paymentMethod).code;

    const tx = await prisma.transaction.create({
      data: {
        hotelId,
        date: payDate,
        type: "payment",
        category: "accommodation",
        paymentMethod: pmCode,
        amount: row.amount,
        bookingId: bookingId ?? null,
        guestName: row.fullName,
        note: row.comment?.trim() || `[excel:${row.payPeriod}]`,
        roomNumber: row.place || null,
      },
    });
    await setMappedId(seatId, "excel_transaction", txKey, tx.id);
    inc("transactions");

    if (bookingId && row.amount > 0) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paid: { increment: row.amount } },
      });
    }
  }

  for (const row of data.otherRows) {
    const hotelId = hotelByExcelName.get(row.hotelName);
    if (!hotelId) continue;

    const txKey = txDedupKey([
      "other",
      hotelId,
      row.date,
      row.type,
      row.category,
      row.amount,
      row.paymentMethod,
      row.comment,
    ]);
    if (await getMappedId(seatId, "excel_transaction", txKey)) {
      skip("transactions");
      continue;
    }

    const txType = mapBotTransactionType(row.type, row.category, false) as TxType;
    const pmCode =
      paymentCodeByLabel.get(row.paymentMethod) ?? mapBotPaymentLabel(row.paymentMethod).code;
    let category = "accommodation";
    if (txType === "expense") category = mapBotExpenseCategory(row.category);
    else if (txType === "encashment") category = "encashment";
    else if (txType === "refund") category = "accommodation";
    else if (!isGuestCategory(row.category)) category = mapBotExpenseCategory(row.category);

    const tx = await prisma.transaction.create({
      data: {
        hotelId,
        date: parseRuDate(row.date) ?? new Date(),
        type: txType,
        category,
        paymentMethod: pmCode,
        amount: row.amount,
        guestName: row.payer?.trim() || null,
        note: row.comment?.trim() || `[excel:${row.category}]`,
        roomNumber: null,
      },
    });
    await setMappedId(seatId, "excel_transaction", txKey, tx.id);
    inc("transactions");
  }

  return {
    ok: true,
    created,
    skipped,
    warnings,
    stats: computePreviewStats(data, aliasMap),
  };
}
