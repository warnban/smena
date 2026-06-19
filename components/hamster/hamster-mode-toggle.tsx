"use client";

import { useHamsterMode } from "@/components/providers/hamster-mode";

export function HamsterModeToggle({ className = "" }: { className?: string }) {
  const { enabled, canUse, toggle } = useHamsterMode();

  if (!canUse) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${className} ${
        enabled
          ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-600"
          : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      title="Режим хомячка — AI copilot"
    >
      <span aria-hidden>🐹</span>
      <span>{enabled ? "Хомячок ON" : "Хомячок"}</span>
    </button>
  );
}
