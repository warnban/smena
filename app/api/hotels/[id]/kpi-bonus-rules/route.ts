import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import type { KpiMetric } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function hotelId(params: RouteParams["params"]): Promise<string> {
  const resolved = await Promise.resolve(params);
  return resolved.id?.trim() ?? "";
}

const METRICS = new Set<KpiMetric>(["revpar", "occupancy", "cash_revenue", "total_revenue", "adr"]);

export async function GET(_req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = await hotelId(context.params);
    const auth = await assertCanManageHotel(session, id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rules = await prisma.kpiBonusRule.findMany({
      where: { hotelId: id },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return NextResponse.json({ rules });
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
    const rules = (body.rules ?? []) as Array<{
      label: string;
      metric: KpiMetric;
      threshold: number;
      bonusAmount: number;
      active: boolean;
    }>;

    await prisma.$transaction(async (tx) => {
      await tx.kpiBonusRule.deleteMany({ where: { hotelId: id } });
      if (rules.length) {
        await tx.kpiBonusRule.createMany({
          data: rules.map((r, i) => ({
            hotelId: id,
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

    const saved = await prisma.kpiBonusRule.findMany({
      where: { hotelId: id },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return NextResponse.json({ ok: true, rules: saved });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
