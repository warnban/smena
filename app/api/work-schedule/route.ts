import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { mskAddDays, mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import type { ShiftRole } from "@prisma/client";

const ADMIN_ROLES: ShiftRole[] = ["day_admin", "night_admin"];

function dateFromKey(key: string): Date {
  return parseMskDateKey(key.slice(0, 10));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!hotelId || !from || !to) {
    return NextResponse.json({ error: "hotelId, from, to обязательны" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const entries = await prisma.workScheduleEntry.findMany({
    where: {
      hotelId,
      date: { gte: dateFromKey(from), lte: dateFromKey(to) },
    },
    include: { staff: { select: { id: true, name: true, role: true, initials: true } } },
    orderBy: [{ date: "asc" }, { role: "asc" }],
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      date: mskDateKey(e.date),
      staffId: e.staffId,
      staffName: e.staff.name,
      staffInitials: e.staff.initials,
      staffRole: e.staff.role,
      role: e.role,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const hotelId = String(body.hotelId ?? "");
  const weekStart = String(body.weekStart ?? "").slice(0, 10);
  const entries = (body.entries ?? []) as { date: string; staffId: string; role: ShiftRole }[];

  if (!hotelId || !weekStart) {
    return NextResponse.json({ error: "hotelId и weekStart обязательны" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const startKey = weekStart;
  const endKey = mskAddDays(startKey, 6);
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);

  const adminByDay: Record<string, Partial<Record<ShiftRole, string>>> = {};
  for (const e of entries) {
    const dateKey = e.date.slice(0, 10);
    if (ADMIN_ROLES.includes(e.role)) {
      if (!adminByDay[dateKey]) adminByDay[dateKey] = {};
      if (adminByDay[dateKey]![e.role]) {
        return NextResponse.json({ error: `На ${dateKey} уже назначен ${e.role}` }, { status: 400 });
      }
      adminByDay[dateKey]![e.role] = e.staffId;
    }
  }

  const staffIds = Array.from(new Set(entries.map((e) => e.staffId).filter(Boolean)));
  if (staffIds.length) {
    const staffList = await prisma.staff.findMany({
      where: { id: { in: staffIds }, seatId: session.seatId },
      include: { hotels: true },
    });
    if (staffList.length !== staffIds.length) {
      return NextResponse.json({ error: "Некоторые сотрудники не найдены" }, { status: 400 });
    }
    for (const s of staffList) {
      if (!s.hotels.some((h) => h.hotelId === hotelId)) {
        return NextResponse.json({ error: `${s.name} не привязан к отелю` }, { status: 400 });
      }
    }
  }

  const staffList = staffIds.length
    ? await prisma.staff.findMany({
        where: { id: { in: staffIds }, seatId: session.seatId },
        select: { id: true, name: true },
      })
    : [];
  const staffNames = Object.fromEntries(staffList.map((s) => [s.id, s.name]));

  await prisma.$transaction(async (tx) => {
    await tx.workScheduleEntry.deleteMany({
      where: { hotelId, date: { gte: start, lte: end } },
    });

    const validEntries = entries.filter((e) => e.staffId);
    if (validEntries.length) {
      await tx.workScheduleEntry.createMany({
        data: validEntries.map((e) => ({
          hotelId,
          date: dateFromKey(e.date),
          staffId: e.staffId,
          role: e.role,
        })),
      });
    }

    for (let i = 0; i < 7; i++) {
      const dateKey = mskAddDays(startKey, i);
      const day = dateFromKey(dateKey);
      const dayAdminId = adminByDay[dateKey]?.day_admin;
      const nightAdminId = adminByDay[dateKey]?.night_admin;
      await tx.dailyShiftLog.upsert({
        where: { hotelId_date: { hotelId, date: day } },
        create: {
          hotelId,
          date: day,
          dayAdminName: dayAdminId ? staffNames[dayAdminId] ?? "" : "",
          nightAdminName: nightAdminId ? staffNames[nightAdminId] ?? "" : "",
        },
        update: {
          dayAdminName: dayAdminId ? staffNames[dayAdminId] ?? "" : "",
          nightAdminName: nightAdminId ? staffNames[nightAdminId] ?? "" : "",
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
