import "server-only";

import type { NextRequest } from "next/server";

function originFromEnv(): string | null {
  for (const key of ["CRM_PUBLIC_URL", "NEXT_PUBLIC_CRM_URL"]) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      const u = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
      return u.origin;
    } catch {
      /* skip invalid */
    }
  }
  return null;
}

function isBadHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.startsWith("0.0.0.0") ||
    h.startsWith("127.0.0.1") ||
    h.startsWith("localhost")
  );
}

/** Публичный origin CRM для ссылок (приглашения, письма). */
export function resolvePublicOrigin(req?: NextRequest): string {
  const envOrigin = originFromEnv();
  if (envOrigin) return envOrigin;

  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host")?.trim();
    if (host && !isBadHost(host)) {
      return `${proto}://${host}`;
    }
    if (!isBadHost(req.nextUrl.host)) {
      return req.nextUrl.origin;
    }
  }

  return "http://localhost:3000";
}

export function staffInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/register/staff?token=${encodeURIComponent(token)}`;
}
