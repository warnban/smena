/**
 * Маршрутизация по хосту для prod (app.* / dev.* / landing).
 * Локально используются пути: /, /login, /platform.
 */
export type AppZone = "marketing" | "crm" | "platform";

export function resolveAppZone(host: string, pathname: string): AppZone {
  const h = host.split(":")[0].toLowerCase();

  if (h.startsWith("dev.") || h.startsWith("platform.") || pathname.startsWith("/platform")) {
    return "platform";
  }
  if (h.startsWith("app.") || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/dashboard") || pathname.startsWith("/api/auth")) {
    return "crm";
  }
  if (
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
    pathname.startsWith("/refunds")
  ) {
    return "crm";
  }
  if (pathname === "/" || pathname.startsWith("/landing")) {
    return "marketing";
  }
  return "crm";
}

export function crmAppUrl(path = "/dashboard"): string {
  const base = process.env.NEXT_PUBLIC_CRM_URL ?? "";
  if (base) return `${base.replace(/\/$/, "")}${path}`;
  return path;
}

export function platformUrl(path = "/platform"): string {
  const base = process.env.NEXT_PUBLIC_PLATFORM_URL ?? "";
  if (base) return `${base.replace(/\/$/, "")}${path}`;
  return path;
}
