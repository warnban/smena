import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel, assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard } from "@/lib/meters.server";
import type { UtilityMeterType } from "@/lib/meters";

const METER_TYPES = new Set(["gvs", "hvs", "electricity"]);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const board = await buildMetersBoard(hotelId);
    return NextResponse.json({ board });
  } catch (e) {
    console.error("[meters GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "").trim();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const hotelAuth = await assertCanManageHotel(session, hotelId);
    if (!hotelAuth.ok) return NextResponse.json({ error: hotelAuth.error }, { status: hotelAuth.status });

    const zoneName = String(body.zoneName ?? "").trim();
    const meterType = String(body.meterType ?? "").trim() as UtilityMeterType;
    if (!zoneName) {
      return NextResponse.json({ error: "Укажите название зоны" }, { status: 400 });
    }
    if (!METER_TYPES.has(meterType)) {
      return NextResponse.json({ error: "Некорректный тип счётчика" }, { status: 400 });
    }

    const maxSort = await prisma.utilityMeter.aggregate({
      where: { hotelId },
      _max: { sortOrder: true },
    });

    const row = await prisma.utilityMeter.create({
      data: {
        hotelId,
        zoneName,
        meterType,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    const board = await buildMetersBoard(hotelId);
    return NextResponse.json({ ok: true, meter: row, board });
  } catch (e) {
    console.error("[meters POST]", e);
    const msg = apiErrorMessage(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Такая зона с этим типом уже есть" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
