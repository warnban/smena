"use client";

import { TopBar } from "@/components/shell/topbar";

export function PageStub({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <TopBar title={title} subtitle={subtitle} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">Раздел в разработке</div>
        </div>
      </div>
    </>
  );
}
