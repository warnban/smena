import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard } from "@/lib/meters.server";

function parseReadingDate(v: string): Date | null {
  const s = v.trim();
  if (!s) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "").trim();
    const meterId = String(body.meterId ?? "").trim();
    const readingDate = parseReadingDate(String(body.readingDate ?? ""));
    const value = Number(body.value);

    if (!hotelId || !meterId || !readingDate) {
      return NextResponse.json({ error: "Заполните отель, счётчик и дату" }, { status: 400 });
    }
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Некорректное показание" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const meter = await prisma.utilityMeter.findFirst({
      where: { id: meterId, hotelId, hotel: { seatId: session.seatId }, active: true },
    });
    if (!meter) {
      return NextResponse.json({ error: "Счётчик не найден" }, { status: 404 });
    }

    const transmitted = Boolean(body.transmitted);
    const notes = String(body.notes ?? "").trim().slice(0, 500);

    const row = await prisma.utilityReading.upsert({
      where: { meterId_readingDate: { meterId, readingDate } },
      create: {
        meterId,
        hotelId,
        readingDate,
        value,
        transmitted,
        notes,
      },
      update: { value, transmitted, notes },
    });

    const board = await buildMetersBoard(hotelId);
    return NextResponse.json({ ok: true, reading: row, board });
  } catch (e) {
    console.error("[meters readings POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
