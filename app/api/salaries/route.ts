import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite, canManageSettings } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { buildSalarySummaries } from "@/lib/schedule-salary";
import { loadDailyReportOccupancy } from "@/lib/occupancy-rates";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId");
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!hotelId) {
    return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const canManage = canManageSettings(session.role);
  const currentStaff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
  });

  const staffWhere = canManage
    ? { seatId: session.seatId, hotels: { some: { hotelId } } }
    : currentStaff
      ? { id: currentStaff.id }
      : { id: "__none__" };

  const dateFilter =
    from && to
      ? { gte: parseMskDateKey(from), lte: parseMskDateKey(to) }
      : undefined;

  const [staff, schedule, ledger, occupancyTiers, hotel, bookings, rooms, beds] = await Promise.all([
    prisma.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        role: true,
        initials: true,
        dayShiftRate: true,
        nightShiftRate: true,
        hkShiftRate: true,
      },
    }),
    prisma.workScheduleEntry.findMany({
      where: {
        hotelId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(canManage ? {} : { staffId: currentStaff?.id ?? "__none__" }),
      },
      include: { staff: { select: { name: true } } },
    }),
    prisma.salaryLedgerEntry.findMany({
      where: {
        hotelId,
        type: { in: ["payment", "bonus", "penalty"] },
        ...(from && to ? { date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
        ...(canManage ? {} : { staffId: currentStaff?.id ?? "__none__" }),
      },
    }),
    prisma.occupancyRateTier.findMany({
      where: { hotelId },
      orderBy: [{ sortOrder: "asc" }, { minOccupancy: "asc" }],
    }),
    prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { hkSoloRate: true, hkDuoRate: true },
    }),
    prisma.booking.findMany({ where: { hotelId } }),
    prisma.room.findMany({ where: { hotelId } }),
    prisma.bed.findMany({ where: { hotelId } }),
  ]);

  const scheduleDates = schedule.map((e) => mskDateKey(e.date));
  const uniqueDates = Array.from(new Set(scheduleDates));
  const reportOcc = from && to ? await loadDailyReportOccupancy(prisma, hotelId, from, to) : {};

  const { buildOccupancyMap } = await import("@/lib/occupancy-rates");
  const occupancyByDate = buildOccupancyMap(bookings, rooms, uniqueDates, reportOcc, beds);

  const summaries = buildSalarySummaries({
    schedule: schedule.map((e) => ({
      date: mskDateKey(e.date),
      staffId: e.staffId,
      staffName: e.staff.name,
      role: e.role as "day_admin" | "night_admin" | "housekeeping",
    })),
    staff,
    payments: ledger.map((l) => ({
      staffId: l.staffId,
      type: l.type as "payment" | "bonus" | "penalty",
      amount: l.amount,
    })),
    periodFrom: from || undefined,
    periodTo: to || undefined,
    occupancyByDate,
    occupancyTiers: occupancyTiers.map((t) => ({
      minOccupancy: t.minOccupancy,
      maxOccupancy: t.maxOccupancy,
      dayRate: t.dayRate,
      nightRate: t.nightRate,
    })),
    hkRates: {
      hkSoloRate: hotel?.hkSoloRate ?? 5000,
      hkDuoRate: hotel?.hkDuoRate ?? 3500,
    },
  });

  return NextResponse.json({
    summaries,
    canManage,
    staffRates: staff,
    occupancyTiers,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId || !canManageSettings(session.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await req.json();
  const hotelId = String(body.hotelId ?? "");
  const staffId = String(body.staffId ?? "");
  const amount = Math.round(Number(body.amount) || 0);
  const paymentMethod = String(body.paymentMethod ?? "cash");
  const kind = body.kind === "bonus" ? "bonus" : body.kind === "penalty" ? "penalty" : "salary";
  const note = String(body.note ?? "").trim();
  const payAll = Boolean(body.payAll);

  if (!hotelId) {
    return NextResponse.json({ error: "Укажите отель" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) {
    return NextResponse.json({ error: payLock.error }, { status: payLock.status });
  }

  const from = body.periodFrom ? String(body.periodFrom) : undefined;
  const to = body.periodTo ? String(body.periodTo) : undefined;

  let payouts: { staffId: string; amount: number; kind: "salary" | "bonus" | "penalty" }[] = [];

  if (payAll) {
    const staff = await prisma.staff.findMany({
      where: { seatId: session.seatId, hotels: { some: { hotelId } } },
      select: {
        id: true,
        name: true,
        role: true,
        dayShiftRate: true,
        nightShiftRate: true,
        hkShiftRate: true,
      },
    });
    const [schedule, ledger, occupancyTiers, hotel, bookings, rooms, beds] = await Promise.all([
      prisma.workScheduleEntry.findMany({
        where: { hotelId, ...(from && to ? { date: { gte: parseMskDateKey(from), lte: parseMskDateKey(to) } } : {}) },
      }),
      prisma.salaryLedgerEntry.findMany({
        where: {
          hotelId,
          type: { in: ["payment", "bonus", "penalty"] },
          ...(from && to ? { date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
        },
      }),
      prisma.occupancyRateTier.findMany({ where: { hotelId } }),
      prisma.hotel.findUnique({ where: { id: hotelId }, select: { hkSoloRate: true, hkDuoRate: true } }),
      prisma.booking.findMany({ where: { hotelId } }),
      prisma.room.findMany({ where: { hotelId } }),
      prisma.bed.findMany({ where: { hotelId } }),
    ]);

    const scheduleDates = schedule.map((e) => mskDateKey(e.date));
    const reportOcc = from && to ? await loadDailyReportOccupancy(prisma, hotelId, from, to) : {};
    const { buildOccupancyMap } = await import("@/lib/occupancy-rates");
    const occupancyByDate = buildOccupancyMap(bookings, rooms, Array.from(new Set(scheduleDates)), reportOcc, beds);

    const summaries = buildSalarySummaries({
      schedule: schedule.map((e) => ({
        date: mskDateKey(e.date),
        staffId: e.staffId,
        role: e.role as "day_admin" | "night_admin" | "housekeeping",
      })),
      staff,
      payments: ledger.map((l) => ({
        staffId: l.staffId,
        type: l.type as "payment" | "bonus" | "penalty",
        amount: l.amount,
      })),
      periodFrom: from,
      periodTo: to,
      occupancyByDate,
      occupancyTiers: occupancyTiers.map((t) => ({
        minOccupancy: t.minOccupancy,
        maxOccupancy: t.maxOccupancy,
        dayRate: t.dayRate,
        nightRate: t.nightRate,
      })),
      hkRates: {
        hkSoloRate: hotel?.hkSoloRate ?? 5000,
        hkDuoRate: hotel?.hkDuoRate ?? 3500,
      },
    });
    payouts = summaries
      .filter((s) => s.balance > 0)
      .map((s) => ({ staffId: s.staffId, amount: s.balance, kind: "salary" as const }));
    if (!payouts.length) {
      return NextResponse.json({ error: "Нет задолженности по зарплате" }, { status: 400 });
    }
  } else {
    if (!staffId || amount <= 0) {
      return NextResponse.json({ error: "Укажите сотрудника и сумму" }, { status: 400 });
    }
    payouts = [{ staffId, amount, kind }];
  }

  const staffRecords = await prisma.staff.findMany({
    where: { id: { in: payouts.map((p) => p.staffId) }, seatId: session.seatId },
  });
  const nameMap = Object.fromEntries(staffRecords.map((s) => [s.id, s.name]));

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const p of payouts) {
      const staffName = nameMap[p.staffId];
      if (!staffName) continue;
      const category = p.kind === "bonus" ? "bonus" : "salary";
      const ledgerType = p.kind === "penalty" ? "penalty" : p.kind === "bonus" ? "bonus" : "payment";
      const transaction = await tx.transaction.create({
        data: {
          hotelId,
          date: now,
          type: "expense",
          category,
          paymentMethod,
          amount: p.amount,
          guestName: staffName,
          note: note || (p.kind === "bonus" ? "Премия" : p.kind === "penalty" ? "Штраф" : "Выплата зарплаты"),
        },
      });
      await tx.salaryLedgerEntry.create({
        data: {
          staffId: p.staffId,
          hotelId,
          date: now,
          type: ledgerType,
          amount: p.amount,
          paymentMethod,
          transactionId: transaction.id,
          note: note || "",
        },
      });
    }
  });

  return NextResponse.json({ ok: true, count: payouts.length });
}
