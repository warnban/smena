"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LoadErrorBanner } from "@/components/shell/load-error-banner";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex min-h-dvh min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col pb-bottom-nav md:pb-0 overflow-x-hidden">
          <LoadErrorBanner />
          {children}
        </main>
      </div>
      <BottomNav />
      <AssistantPanel />
    </>
  );
}
