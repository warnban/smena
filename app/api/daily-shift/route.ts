import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId");
  const dateStr = req.nextUrl.searchParams.get("date");
  if (!hotelId || !dateStr) {
    return NextResponse.json({ error: "hotelId и date обязательны" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const date = new Date(dateStr);
  const shift = await prisma.dailyShiftLog.findUnique({
    where: { hotelId_date: { hotelId, date } },
  });

  return NextResponse.json({
    shift: shift ?? { dayAdminName: "", nightAdminName: "" },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const hotelId = String(body.hotelId ?? "");
  const dateStr = String(body.date ?? "");
  if (!hotelId || !dateStr) {
    return NextResponse.json({ error: "hotelId и date обязательны" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const date = new Date(dateStr);
  const shift = await prisma.dailyShiftLog.upsert({
    where: { hotelId_date: { hotelId, date } },
    create: {
      hotelId,
      date,
      dayAdminName: body.dayAdminName ?? "",
      nightAdminName: body.nightAdminName ?? "",
    },
    update: {
      dayAdminName: body.dayAdminName ?? "",
      nightAdminName: body.nightAdminName ?? "",
    },
  });

  return NextResponse.json({ ok: true, shift });
}
