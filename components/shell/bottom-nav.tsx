"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { MobileMoreSheet } from "@/components/shell/mobile-more-sheet";
import { isMobileMoreActive, isNavActive, MOBILE_TAB_ITEMS } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMobileMoreActive(pathname);

  return (
    <>
      <nav
        className="app-bottom-nav fixed bottom-0 inset-x-0 z-40 md:hidden bg-card/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Основная навигация"
      >
        <div className="flex items-stretch h-[3.75rem] max-w-lg mx-auto">
          {MOBILE_TAB_ITEMS.map((item) => {
            const on = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  on ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon name={item.icon} size={20} strokeWidth={on ? 2.5 : 2} />
                <span className={`text-[10px] leading-tight truncate max-w-full ${on ? "font-bold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
              moreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu size={20} strokeWidth={moreActive ? 2.5 : 2} />
            <span className={`text-[10px] leading-tight ${moreActive ? "font-bold" : "font-medium"}`}>Ещё</span>
          </button>
        </div>
      </nav>
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
