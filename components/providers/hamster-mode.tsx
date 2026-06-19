"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HAMSTER_STORAGE_KEY } from "@/lib/assistant/hamster-workflows";

type HamsterModeContext = {
  enabled: boolean;
  canUse: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
};

const Ctx = createContext<HamsterModeContext | null>(null);

export function HamsterModeProvider({
  children,
  canUse,
}: {
  children: React.ReactNode;
  canUse: boolean;
}) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HAMSTER_STORAGE_KEY);
      if (saved === "true" && canUse) setEnabledState(true);
    } catch {}
  }, [canUse]);

  const setEnabled = useCallback(
    (v: boolean) => {
      if (!canUse && v) return;
      setEnabledState(v);
      try {
        localStorage.setItem(HAMSTER_STORAGE_KEY, v ? "true" : "false");
      } catch {}
    },
    [canUse]
  );

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  const value = useMemo(
    () => ({ enabled: canUse && enabled, canUse, setEnabled, toggle }),
    [enabled, canUse, setEnabled, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHamsterMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHamsterMode must be used within HamsterModeProvider");
  return ctx;
}
