import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchBotExport } from "@/lib/migration/bot-fetch.server";
import { importBotExport } from "@/lib/migration/bot-import.server";
import { apiErrorMessage } from "@/lib/api-error";

/** Импорт больших сетей может занимать несколько минут. */
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId || session.role !== "owner") {
      return NextResponse.json({ error: "Только владелец может импортировать данные" }, { status: 403 });
    }

    const body = await req.json();
    const botUrl = String(body.botUrl ?? "").trim();
    const secret = String(body.secret ?? "").trim();
    const fromDate = String(body.fromDate ?? "2025-06-01").slice(0, 10);
    const networkId = String(body.networkId ?? "").trim();
    const renameSeat = body.renameSeat !== false;

    if (!botUrl || !secret || !networkId) {
      return NextResponse.json(
        { error: "Укажите URL старой CRM, ключ и сеть для импорта" },
        { status: 400 }
      );
    }

    const pack = await fetchBotExport(botUrl, secret, networkId, fromDate);
    const result = await importBotExport(session.seatId, pack, { renameSeat });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[migration/import]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
