import { NextResponse } from "next/server";
import { clearPlatformDevCookie } from "@/lib/platform-dev-auth.server";

export async function POST() {
  await clearPlatformDevCookie();
  return NextResponse.json({ ok: true });
}
