import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildLinenOverview } from "@/lib/linen-control.server";

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

    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 30));
    const overview = await buildLinenOverview(hotelId, days);
    if (!overview) {
      return NextResponse.json({ error: "Отель не найден" }, { status: 404 });
    }

    return NextResponse.json({ overview });
  } catch (e) {
    console.error("[linen overview GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
