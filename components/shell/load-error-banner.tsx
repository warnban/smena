"use client";

import { useApp } from "@/components/providers/app-data";

export function LoadErrorBanner() {
  const { loadError, loading, refresh } = useApp();
  if (loading || !loadError) return null;

  return (
    <div className="mx-6 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start justify-between gap-4">
      <div>
        <p className="text-[13px] font-bold text-destructive">Данные не загрузились</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{loadError}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Проверьте, что Docker с PostgreSQL запущен: <code className="font-mono">docker compose -f docker-compose.dev.yml up -d</code>
        </p>
      </div>
      <button
        type="button"
        onClick={() => refresh()}
        className="shrink-0 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-card border border-border hover:bg-muted"
      >
        Повторить
      </button>
    </div>
  );
}
