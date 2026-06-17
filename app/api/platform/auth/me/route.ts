import { NextResponse } from "next/server";
import { getPlatformDevSession, platformDevConfigured } from "@/lib/platform-dev-auth.server";

export async function GET() {
  const configured = platformDevConfigured();
  const session = configured ? await getPlatformDevSession() : null;
  return NextResponse.json({
    configured,
    session: session ? { email: session.email } : null,
  });
}
