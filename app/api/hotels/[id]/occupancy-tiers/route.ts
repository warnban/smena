import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function hotelId(params: RouteParams["params"]): Promise<string> {
  const resolved = await Promise.resolve(params);
  return resolved.id?.trim() ?? "";
}

export async function GET(_req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = await hotelId(context.params);
    const auth = await assertCanManageHotel(session, id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const tiers = await prisma.occupancyRateTier.findMany({
      where: { hotelId: id },
      orderBy: [{ sortOrder: "asc" }, { minOccupancy: "asc" }],
    });
    return NextResponse.json({ tiers });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = await hotelId(context.params);
    const auth = await assertCanManageHotel(session, id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const tiers = (body.tiers ?? []) as Array<{
      minOccupancy: number;
      maxOccupancy: number;
      dayRate: number;
      nightRate: number;
    }>;

    await prisma.$transaction(async (tx) => {
      await tx.occupancyRateTier.deleteMany({ where: { hotelId: id } });
      if (tiers.length) {
        await tx.occupancyRateTier.createMany({
          data: tiers.map((t, i) => ({
            hotelId: id,
            minOccupancy: Math.max(0, Math.min(100, Math.round(t.minOccupancy))),
            maxOccupancy: Math.max(0, Math.min(100, Math.round(t.maxOccupancy))),
            dayRate: Math.max(0, Math.round(t.dayRate)),
            nightRate: Math.max(0, Math.round(t.nightRate)),
            sortOrder: i,
          })),
        });
      }
    });

    const saved = await prisma.occupancyRateTier.findMany({
      where: { hotelId: id },
      orderBy: [{ sortOrder: "asc" }, { minOccupancy: "asc" }],
    });
    return NextResponse.json({ ok: true, tiers: saved });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
