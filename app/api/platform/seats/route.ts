import { NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { getPlatformSeatsWithHotels } from "@/lib/platform-dev-data.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET() {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const seats = await getPlatformSeatsWithHotels();
    return NextResponse.json({ ok: true, seats });
  } catch (e) {
    console.error("[platform seats]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
