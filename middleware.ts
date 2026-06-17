import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import {
  PLATFORM_DEV_COOKIE,
  verifyPlatformDevToken,
} from "@/lib/platform-dev-token";

const CRM_PUBLIC = ["/login", "/register"];
const CRM_PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/health"];
const PLATFORM_PUBLIC = ["/platform/login"];
const PLATFORM_PUBLIC_API = ["/api/platform/auth/login", "/api/platform/auth/logout"];

function isPublicInvitePreview(pathname: string, method: string) {
  return method === "GET" && /^\/api\/staff\/invites\/[a-f0-9]+$/.test(pathname);
}

function isCrmAppPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/grid") ||
    pathname.startsWith("/guests") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/channels") ||
    pathname.startsWith("/housekeeping") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/organizations") ||
    pathname.startsWith("/refunds") ||
    pathname.startsWith("/api/") && !pathname.startsWith("/api/platform")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Панель разработчика (/platform → dev.domen.ru) ───
  if (pathname.startsWith("/platform") || pathname.startsWith("/api/platform")) {
    const isPublicPage = PLATFORM_PUBLIC.some((p) => pathname.startsWith(p));
    const isPublicApi = PLATFORM_PUBLIC_API.some((p) => pathname.startsWith(p));
    const token = request.cookies.get(PLATFORM_DEV_COOKIE)?.value;
    let platformValid = false;
    if (token) {
      platformValid = Boolean(await verifyPlatformDevToken(token));
    }

    if (isPublicApi) return NextResponse.next();

    if (!platformValid && !isPublicPage) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }
    if (platformValid && pathname === "/platform/login") {
      return NextResponse.redirect(new URL("/platform", request.url));
    }
    return NextResponse.next();
  }

  // ─── CRM (app.domen.ru) ───
  const crmToken = request.cookies.get("auth-token")?.value;
  const isPublicPage = CRM_PUBLIC.some((p) => pathname.startsWith(p));
  const isPublicApi =
    CRM_PUBLIC_API.some((p) => pathname.startsWith(p)) || isPublicInvitePreview(pathname, request.method);

  let crmValid = false;
  if (crmToken) {
    try {
      await jwtVerify(crmToken, getJwtSecret());
      crmValid = true;
    } catch {
      const res = isPublicPage || pathname === "/"
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete("auth-token");
      return res;
    }
  }

  if (isPublicApi) return NextResponse.next();

  // Лендинг (domen.ru) — главная без редиректа
  if (pathname === "/") {
    if (crmValid) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!crmValid && !isPublicPage && isCrmAppPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (crmValid && isPublicPage && !pathname.startsWith("/register/staff")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|icon|apple-icon|manifest.webmanifest|guests/form-print).*)"],
};
