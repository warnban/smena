import { NextRequest, NextResponse } from "next/server";
import {
  generatePlatformDevToken,
  platformDevConfigured,
  setPlatformDevCookie,
  verifyPlatformDevCredentials,
} from "@/lib/platform-dev-auth.server";

export async function POST(req: NextRequest) {
  if (!platformDevConfigured()) {
    return NextResponse.json(
      { error: "Панель не настроена. Задайте PLATFORM_DEV_EMAIL и PLATFORM_DEV_PASSWORD." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Укажите email и пароль" }, { status: 400 });
  }

  if (!verifyPlatformDevCredentials(email, password)) {
    return NextResponse.json({ error: "Неверные учётные данные" }, { status: 401 });
  }

  const token = await generatePlatformDevToken(email);
  await setPlatformDevCookie(token);

  return NextResponse.json({ ok: true, email });
}
