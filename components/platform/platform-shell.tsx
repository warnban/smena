"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, LogOut, Shield,
} from "lucide-react";

const NAV = [
  { href: "/platform", label: "Обзор", icon: LayoutDashboard, exact: true },
  { href: "/platform/seats", label: "Сети и отели", icon: Building2 },
  { href: "/platform/users", label: "Пользователи", icon: Users },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    router.push("/platform/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-56 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-violet-400" />
            <div>
              <p className="text-xs font-black">Platform Dev</p>
              <p className="text-[10px] text-slate-500">dev.domen.ru</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold ${
                  active ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link href="/" className="block px-3 py-2 text-[11px] text-slate-500 hover:text-slate-300">
            ← Лендинг
          </Link>
          <Link href="/login" className="block px-3 py-2 text-[11px] text-slate-500 hover:text-slate-300">
            CRM (app)
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-semibold text-slate-400 hover:text-red-400"
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
