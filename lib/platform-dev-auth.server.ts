import "server-only";

import { timingSafeEqual } from "crypto";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { getJwtSecret } from "@/lib/jwt-secret";
import {
  PLATFORM_DEV_COOKIE,
  verifyPlatformDevToken,
  type PlatformDevSession,
} from "@/lib/platform-dev-token";

export { PLATFORM_DEV_COOKIE, verifyPlatformDevToken, type PlatformDevSession };

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function platformDevConfigured(): boolean {
  return Boolean(process.env.PLATFORM_DEV_EMAIL && process.env.PLATFORM_DEV_PASSWORD);
}

export function verifyPlatformDevCredentials(email: string, password: string): boolean {
  const devEmail = process.env.PLATFORM_DEV_EMAIL?.trim().toLowerCase();
  const devPass = process.env.PLATFORM_DEV_PASSWORD ?? "";
  if (!devEmail || !devPass) return false;
  return safeEqual(email.trim().toLowerCase(), devEmail) && safeEqual(password, devPass);
}

export async function generatePlatformDevToken(email: string): Promise<string> {
  return new SignJWT({ kind: "platform_dev", email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function getPlatformDevSession(): Promise<PlatformDevSession | null> {
  const token = cookies().get(PLATFORM_DEV_COOKIE)?.value;
  if (!token) return null;
  return verifyPlatformDevToken(token);
}

export async function setPlatformDevCookie(token: string) {
  cookies().set(PLATFORM_DEV_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearPlatformDevCookie() {
  cookies().set(PLATFORM_DEV_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function assertPlatformDev() {
  if (!platformDevConfigured()) {
    return { ok: false as const, status: 503, error: "Панель разработчика не настроена (PLATFORM_DEV_EMAIL / PLATFORM_DEV_PASSWORD)" };
  }
  const session = await getPlatformDevSession();
  if (!session) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}
