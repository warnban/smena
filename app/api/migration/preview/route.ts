import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchBotExport, fetchBotNetworks } from "@/lib/migration/bot-fetch.server";
import { apiErrorMessage } from "@/lib/api-error";

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
    const networkId = body.networkId ? String(body.networkId).trim() : "";

    if (!botUrl || !secret) {
      return NextResponse.json({ error: "Укажите URL старой CRM и ключ миграции" }, { status: 400 });
    }

    if (!networkId) {
      const networks = await fetchBotNetworks(botUrl, secret);
      return NextResponse.json({ networks });
    }

    const pack = await fetchBotExport(botUrl, secret, networkId, fromDate);
    return NextResponse.json({
      preview: true,
      network: pack.network,
      stats: pack.stats,
      fromDate: pack.fromDate,
      objectNames: pack.objects.map((o) => o.name),
      exportedAt: pack.exportedAt,
    });
  } catch (e) {
    console.error("[migration/preview]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
