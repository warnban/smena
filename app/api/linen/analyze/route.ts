import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildLinenOverview } from "@/lib/linen-control.server";
import { analyzeLinenControl } from "@/lib/linen-analyze.server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.AITUNNEL_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "AI-анализ не настроен: добавьте AITUNNEL_API_KEY в .env" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "").trim();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const days = Math.min(90, Math.max(7, Number(body.days) || 30));
    const overview = await buildLinenOverview(hotelId, days);
    if (!overview) {
      return NextResponse.json({ error: "Отель не найден" }, { status: 404 });
    }

    const commentary = await analyzeLinenControl(overview);

    return NextResponse.json({ ok: true, commentary, overview });
  } catch (e) {
    console.error("[linen analyze POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
