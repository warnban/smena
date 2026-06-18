import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    const auth = await assertCanManage(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "").trim();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, seatId: session!.seatId },
    });
    if (!hotel) {
      return NextResponse.json({ error: "Отель не найден" }, { status: 404 });
    }

    const data: Record<string, number | null> = {};
    if (body.pillowcasesPerChange !== undefined) {
      data.linenPillowcasesPerChange = Math.max(1, Math.round(Number(body.pillowcasesPerChange) || 1));
    }
    if (body.sheetsPerChange !== undefined) {
      data.linenSheetsPerChange = Math.max(1, Math.round(Number(body.sheetsPerChange) || 1));
    }
    if (body.duvetCoversPerChange !== undefined) {
      data.linenDuvetCoversPerChange = Math.max(1, Math.round(Number(body.duvetCoversPerChange) || 1));
    }
    if (body.estimatedSets !== undefined) {
      const v = body.estimatedSets;
      data.linenEstimatedSets =
        v === null || v === "" ? null : Math.max(0, Math.round(Number(v) || 0));
    }

    const updated = await prisma.hotel.update({
      where: { id: hotelId },
      data,
      select: {
        linenPillowcasesPerChange: true,
        linenSheetsPerChange: true,
        linenDuvetCoversPerChange: true,
        linenEstimatedSets: true,
      },
    });

    return NextResponse.json({
      ok: true,
      settings: {
        pillowcasesPerChange: updated.linenPillowcasesPerChange,
        sheetsPerChange: updated.linenSheetsPerChange,
        duvetCoversPerChange: updated.linenDuvetCoversPerChange,
        estimatedSets: updated.linenEstimatedSets,
      },
    });
  } catch (e) {
    console.error("[linen settings PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
