import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard } from "@/lib/meters.server";
import type { UtilityMeterType } from "@/lib/meters";

const METER_TYPES = new Set(["gvs", "hvs", "electricity"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meter = await prisma.utilityMeter.findFirst({
      where: { id: params.id, hotel: { seatId: session.seatId } },
    });
    if (!meter) {
      return NextResponse.json({ error: "Счётчик не найден" }, { status: 404 });
    }

    const auth = await assertCanManageHotel(session, meter.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.zoneName !== undefined) {
      const zoneName = String(body.zoneName).trim();
      if (!zoneName) return NextResponse.json({ error: "Укажите название зоны" }, { status: 400 });
      data.zoneName = zoneName;
    }
    if (body.meterType !== undefined) {
      const meterType = String(body.meterType).trim();
      if (!METER_TYPES.has(meterType)) {
        return NextResponse.json({ error: "Некорректный тип" }, { status: 400 });
      }
      data.meterType = meterType;
    }
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
    if (body.active !== undefined) data.active = Boolean(body.active);

    await prisma.utilityMeter.update({ where: { id: meter.id }, data });

    const board = await buildMetersBoard(meter.hotelId);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    console.error("[meters PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meter = await prisma.utilityMeter.findFirst({
      where: { id: params.id, hotel: { seatId: session.seatId } },
    });
    if (!meter) {
      return NextResponse.json({ error: "Счётчик не найден" }, { status: 404 });
    }

    const auth = await assertCanManageHotel(session, meter.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await prisma.utilityMeter.delete({ where: { id: meter.id } });

    const board = await buildMetersBoard(meter.hotelId);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    console.error("[meters DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
