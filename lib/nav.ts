import { NAV_ITEMS } from "@/lib/constants";

export interface NavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
}

export const MOBILE_TAB_ITEMS: NavItem[] = [
  { id: "dashboard", href: "/dashboard", icon: "LayoutDashboard", label: "Главная" },
  { id: "bookings", href: "/bookings", icon: "BookOpen", label: "Брони" },
  { id: "guests", href: "/guests", icon: "Users", label: "Гости" },
  { id: "reports", href: "/reports", icon: "BarChart3", label: "Отчёты" },
];

const MOBILE_TAB_HREFS = new Set(MOBILE_TAB_ITEMS.map((i) => i.href));

export function flattenNavItems(): NavItem[] {
  return NAV_ITEMS.flatMap((g) => g.items);
}

export function mobileMoreNavItems(): NavItem[] {
  return flattenNavItems().filter((i) => !MOBILE_TAB_HREFS.has(i.href));
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMobileMoreActive(pathname: string): boolean {
  return mobileMoreNavItems().some((i) => isNavActive(pathname, i.href));
}
