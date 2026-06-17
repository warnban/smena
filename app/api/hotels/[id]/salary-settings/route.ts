import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import type { KpiMetric } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function resolveHotelId(params: RouteParams["params"]): Promise<string> {
  const resolved = await Promise.resolve(params);
  return resolved.id?.trim() ?? "";
}

const METRICS = new Set<KpiMetric>(["revpar", "occupancy", "cash_revenue", "total_revenue", "adr"]);

export async function GET(_req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotelId = await resolveHotelId(context.params);
    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [hotel, tiers, rules] = await Promise.all([
      prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { hkSoloRate: true, hkDuoRate: true },
      }),
      prisma.occupancyRateTier.findMany({
        where: { hotelId },
        orderBy: [{ sortOrder: "asc" }, { minOccupancy: "asc" }],
      }),
      prisma.kpiBonusRule.findMany({
        where: { hotelId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);

    return NextResponse.json({
      hkSoloRate: hotel?.hkSoloRate ?? 5000,
      hkDuoRate: hotel?.hkDuoRate ?? 3500,
      tiers: tiers.map(({ minOccupancy, maxOccupancy, dayRate, nightRate }) => ({
        minOccupancy,
        maxOccupancy,
        dayRate,
        nightRate,
      })),
      rules,
    });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotelId = await resolveHotelId(context.params);
    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const hkSoloRate = Math.max(0, Math.round(Number(body.hkSoloRate) || 0));
    const hkDuoRate = Math.max(0, Math.round(Number(body.hkDuoRate) || 0));
    const tiers = (body.tiers ?? []) as Array<{
      minOccupancy: number;
      maxOccupancy: number;
      dayRate: number;
      nightRate: number;
    }>;
    const rules = (body.rules ?? []) as Array<{
      label: string;
      metric: KpiMetric;
      threshold: number;
      bonusAmount: number;
      active: boolean;
    }>;

    await prisma.$transaction(async (tx) => {
      await tx.hotel.update({
        where: { id: hotelId },
        data: { hkSoloRate, hkDuoRate },
      });

      await tx.occupancyRateTier.deleteMany({ where: { hotelId } });
      if (tiers.length) {
        await tx.occupancyRateTier.createMany({
          data: tiers.map((t, i) => ({
            hotelId,
            minOccupancy: Math.max(0, Math.min(100, Math.round(t.minOccupancy))),
            maxOccupancy: Math.max(0, Math.min(100, Math.round(t.maxOccupancy))),
            dayRate: Math.max(0, Math.round(t.dayRate)),
            nightRate: Math.max(0, Math.round(t.nightRate)),
            sortOrder: i,
          })),
        });
      }

      await tx.kpiBonusRule.deleteMany({ where: { hotelId } });
      if (rules.length) {
        await tx.kpiBonusRule.createMany({
          data: rules.map((r, i) => ({
            hotelId,
            label: String(r.label ?? "").slice(0, 80),
            metric: METRICS.has(r.metric) ? r.metric : "occupancy",
            threshold: Number(r.threshold) || 0,
            bonusAmount: Math.max(0, Math.round(Number(r.bonusAmount) || 0)),
            active: r.active !== false,
            sortOrder: i,
          })),
        });
      }
    });

    return GET(req, context);
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
