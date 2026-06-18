import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildLinenOverview, mapLinenDelivery } from "@/lib/linen-control.server";
import { deleteStoredFile } from "@/lib/object-storage.server";

function parseDeliveryDate(v: string | null | undefined): Date | null {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await prisma.linenDelivery.findFirst({
      where: { id: params.id, hotel: { seatId: session.seatId } },
    });
    if (!row) {
      return NextResponse.json({ error: "Доставка не найдена" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, row.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.deliveredAt !== undefined) {
      const d = parseDeliveryDate(String(body.deliveredAt));
      if (!d) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
      data.deliveredAt = d;
    }
    if (body.pillowcases !== undefined) data.pillowcases = Math.max(0, Math.round(Number(body.pillowcases) || 0));
    if (body.sheets !== undefined) data.sheets = Math.max(0, Math.round(Number(body.sheets) || 0));
    if (body.duvetCovers !== undefined) data.duvetCovers = Math.max(0, Math.round(Number(body.duvetCovers) || 0));
    if (body.washCost !== undefined) data.washCost = Math.max(0, Math.round(Number(body.washCost) || 0));
    if (body.isPaid !== undefined) data.isPaid = Boolean(body.isPaid);
    if (body.notes !== undefined) data.notes = String(body.notes).trim().slice(0, 2000);

    const updated = await prisma.linenDelivery.update({
      where: { id: row.id },
      data,
    });

    return NextResponse.json({ ok: true, delivery: mapLinenDelivery(updated) });
  } catch (e) {
    console.error("[linen delivery PATCH]", e);
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

    const row = await prisma.linenDelivery.findFirst({
      where: { id: params.id, hotel: { seatId: session.seatId } },
    });
    if (!row) {
      return NextResponse.json({ error: "Доставка не найдена" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, row.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (row.invoicePath) {
      await deleteStoredFile(row.invoicePath);
    }

    await prisma.linenDelivery.delete({ where: { id: row.id } });

    const overview = await buildLinenOverview(row.hotelId, 30);

    return NextResponse.json({ ok: true, overview });
  } catch (e) {
    console.error("[linen delivery DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
