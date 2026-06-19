"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useApp } from "@/components/providers/app-data";

type PurgeResult = {
  deleted: {
    transactions: number;
    bookings: number;
    guests: number;
    migrationMaps: number;
    bedsReset: number;
    roomsReset: number;
  };
};

export function PurgeImportPanel({ canEdit }: { canEdit: boolean }) {
  const { refreshSilent } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PurgeResult | null>(null);

  if (!canEdit) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Очистка импорта доступна только владельцу сети.
      </p>
    );
  }

  async function runPurge() {
    if (
      !confirm(
        "Удалить всех гостей, брони и транзакции, созданные импортом?\n\nОтели, номера и койки останутся. Действие необратимо."
      )
    ) {
      return;
    }
    if (!confirm("Подтвердите ещё раз: удалить импортированные данные?")) {
      return;
    }

    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/migration/purge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка удаления"));
        return;
      }
      setResult(data as PurgeResult);
      await refreshSilent();
    } finally {
      setBusy(false);
    }
  }

  const d = result?.deleted;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-foreground">Очистка импортированных данных</h3>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
          Удаляет гостей, брони и транзакции, перенесённые из Excel или старой CRM.
          Номерной фонд, отели и способы оплаты не затрагиваются.
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void runPurge()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-destructive hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Удалить импортированных гостей и транзакции
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-[12px]">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {d && (
        <div className="rounded-xl border border-border p-4 text-[12px] space-y-1">
          <div className="font-bold text-foreground">Удалено</div>
          <p>Транзакции: {d.transactions}</p>
          <p>Брони: {d.bookings}</p>
          <p>Гости: {d.guests}</p>
          <p>Записей миграции: {d.migrationMaps}</p>
          <p className="text-muted-foreground">
            Сброшено статусов: койки {d.bedsReset}, номера {d.roomsReset}
          </p>
        </div>
      )}
    </div>
  );
}
