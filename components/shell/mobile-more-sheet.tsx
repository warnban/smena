"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { HotelSwitcher } from "@/components/shell/hotel-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { useApp } from "@/components/providers/app-data";
import { isNavActive, mobileMoreNavItems } from "@/lib/nav";
import { useEffect, useState } from "react";

export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, seat } = useApp();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const items = mobileMoreNavItems();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmLogout(false);
  }, [open]);

  useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        aria-label="Закрыть меню"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[min(88dvh,640px)] flex flex-col bg-card rounded-t-2xl border border-border shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-[15px] font-bold text-foreground">Ещё</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <div className="border-b border-border">
            <HotelSwitcher />
          </div>

          <nav className="py-2">
            {items.map((item) => {
              const on = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-5 py-3.5 text-[14px] transition-colors ${
                    on ? "text-primary font-semibold bg-accent" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-5 py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}
                >
                  {currentUser?.initials ?? "—"}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-foreground truncate">{currentUser?.name ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{seat?.name ?? currentUser?.position}</div>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div
          className="flex-shrink-0 border-t border-border px-4 pt-3 space-y-2 bg-card"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-[14px] font-bold rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            Закрыть
          </button>

          {confirmLogout ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-[12px] font-semibold text-foreground text-center">
                Выйти из аккаунта?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 py-2 text-[12px] font-semibold rounded-lg bg-muted text-foreground"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="flex-1 py-2 text-[12px] font-bold rounded-lg text-white bg-destructive hover:opacity-90 disabled:opacity-50"
                >
                  {loggingOut ? "Выход…" : "Выйти"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut size={14} />
              Выйти из аккаунта
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
