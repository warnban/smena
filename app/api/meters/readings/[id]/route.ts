import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard } from "@/lib/meters.server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reading = await prisma.utilityReading.findFirst({
      where: { id: params.id, meter: { hotel: { seatId: session.seatId } } },
    });
    if (!reading) {
      return NextResponse.json({ error: "Показание не найдено" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, reading.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.value !== undefined) {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ error: "Некорректное показание" }, { status: 400 });
      }
      data.value = value;
    }
    if (body.transmitted !== undefined) data.transmitted = Boolean(body.transmitted);
    if (body.notes !== undefined) data.notes = String(body.notes).trim().slice(0, 500);

    await prisma.utilityReading.update({ where: { id: reading.id }, data });

    const board = await buildMetersBoard(reading.hotelId);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    console.error("[meters reading PATCH]", e);
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

    const reading = await prisma.utilityReading.findFirst({
      where: { id: params.id, meter: { hotel: { seatId: session.seatId } } },
      include: { attachments: true },
    });
    if (!reading) {
      return NextResponse.json({ error: "Показание не найдено" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, reading.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { deleteStoredFile } = await import("@/lib/object-storage.server");
    for (const a of reading.attachments) {
      if (a.filePath) await deleteStoredFile(a.filePath);
    }

    await prisma.utilityReading.delete({ where: { id: reading.id } });

    const board = await buildMetersBoard(reading.hotelId);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    console.error("[meters reading DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
