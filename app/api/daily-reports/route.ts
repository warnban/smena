import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite, assertCanManageHotel } from "@/lib/permissions";
import { mskDateKey } from "@/lib/msk-time";
import {
  buildPreviewReport,
  closeDailyReport,
  reopenDailyReport,
} from "@/lib/daily-report-service";
import { storedReportFromDb } from "@/lib/daily-report";
import { prisma } from "@/lib/prisma";
import { parseMskDateKey } from "@/lib/msk-time";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    const dateParam = req.nextUrl.searchParams.get("date");
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (dateParam) {
      const closed = await prisma.dailyReport.findUnique({
        where: { hotelId_date: { hotelId, date: parseMskDateKey(dateParam) } },
      });
      if (closed) {
        return NextResponse.json({ closed: true, report: storedReportFromDb(closed) });
      }

      const preview = await buildPreviewReport(hotelId, session.seatId, dateParam);
      if (!preview) {
        return NextResponse.json({ error: "Отель не найден" }, { status: 404 });
      }
      return NextResponse.json({ closed: false, report: preview });
    }

    const history = await prisma.dailyReport.findMany({
      where: { hotelId },
      orderBy: { date: "desc" },
      take: 120,
    });

    return NextResponse.json({
      history: history.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        cashClosing: r.cashClosing,
        grandTotal: r.grandTotal,
        closedAt: r.closedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[daily-reports GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "");
    const dateKey = String(body.date ?? mskDateKey());

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    if (dateKey > mskDateKey()) {
      return NextResponse.json({ error: "Нельзя закрыть отчёт за будущую дату" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await closeDailyReport(hotelId, session.seatId, dateKey, session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, report: result.report });
  } catch (e) {
    console.error("[daily-reports POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId") ?? "";
    const dateKey = req.nextUrl.searchParams.get("date") ?? mskDateKey();

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await reopenDailyReport(hotelId, session.seatId, dateKey);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, report: result.report });
  } catch (e) {
    console.error("[daily-reports DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
