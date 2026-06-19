import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { purgeImportedData } from "@/lib/migration/purge-import.server";
import { apiErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.seatId || session.role !== "owner") {
      return NextResponse.json({ error: "Только владелец может удалять импорт" }, { status: 403 });
    }

    const result = await purgeImportedData(session.seatId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[migration/purge]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
