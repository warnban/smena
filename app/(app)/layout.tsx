"use client";

import { AppDataProvider, useApp } from "@/components/providers/app-data";
import { HamsterModeProvider } from "@/components/providers/hamster-mode";
import { AppShell } from "@/components/shell/app-shell";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { canWriteHotelOps } = useApp();
  return (
    <HamsterModeProvider canUse={canWriteHotelOps}>
      <AppShell>{children}</AppShell>
    </HamsterModeProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppDataProvider>
  );
}
