import { NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { getPlatformUsers } from "@/lib/platform-dev-data.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET() {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const users = await getPlatformUsers();
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("[platform users]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
