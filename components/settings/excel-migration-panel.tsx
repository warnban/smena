"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { money } from "@/lib/format";
import { useApp } from "@/components/providers/app-data";
import type { ExcelImportResult, ExcelPreviewResult } from "@/lib/migration/excel-types";

const LABELS: Record<string, string> = {
  guests: "Гости",
  bookings: "Брони",
  transactions: "Транзакции",
  paymentMethods: "Способы оплаты",
};

function countEntries(map: Record<string, number> | undefined): number {
  if (!map) return 0;
  return Object.values(map).reduce((s, n) => s + n, 0);
}

async function postExcel(url: string, file: File): Promise<{ data: Record<string, unknown>; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!res.ok) return { data, error: String(data.error ?? `Ошибка ${res.status}`) };
    return { data };
  } catch {
    if (res.status === 504) {
      return {
        data: {},
        error:
          "Таймаут nginx (504). Импорт мог продолжиться — проверьте данные в CRM и логи сервера.",
      };
    }
    return { data: {}, error: `Ошибка ${res.status}: сервер вернул не JSON` };
  }
}

export function ExcelMigrationPanel({ canEdit }: { canEdit: boolean }) {
  const { refreshSilent } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelPreviewResult | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canEdit) {
    return (
      <p className="text-[13px] text-muted-foreground">Импорт из Excel доступен только владельцу сети.</p>
    );
  }

  async function runPreview(selected: File) {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const { data, error: err } = await postExcel("/api/migration/excel/preview", selected);
      if (err) {
        setError(err);
        setPreview(null);
        return;
      }
      setPreview(data as unknown as ExcelPreviewResult);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) {
      setError("Выберите файл");
      return;
    }
    if (
      !confirm(
        "Импортировать гостей, брони и транзакции из Excel? Повторный запуск пропустит уже перенесённые записи."
      )
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data, error: err } = await postExcel("/api/migration/excel/import", file);
      if (err) {
        setError(err);
        return;
      }
      setResult(data as unknown as ExcelImportResult);
      await refreshSilent();
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError("");
    if (f) void runPreview(f);
  }

  const createdTotal = countEntries(result?.created);
  const skippedTotal = countEntries(result?.skipped);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-primary" />
          Импорт из Excel
        </h3>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
          Загрузите экспорт из старой CRM. Отдельные номера в Excel могут быть как «16 VIP» — в CRM это номер 16.
          Койки — формат «комната/койко-место» (например 2/14). ИИ помогает при расхождениях в написании.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-primary hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {file ? file.name : "Выбрать .xlsx"}
        </button>
        {preview && file && (
          <button
            type="button"
            disabled={busy || preview.unmatchedHotels.length > 0}
            onClick={() => void runImport()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold border border-primary text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Импортировать
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-[12px]">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-border p-4 space-y-3 text-[12px]">
          <div className="font-bold text-foreground">Предпросмотр</div>

          <div>
            <div className="text-muted-foreground mb-1">Отели</div>
            <ul className="space-y-1">
              {preview.hotels.map((h) => (
                <li key={h.excelName} className="flex flex-wrap gap-2">
                  <span>{h.excelName}</span>
                  <span className="text-muted-foreground">→</span>
                  {h.crmName ? (
                    <span className="text-success font-semibold">{h.crmName}</span>
                  ) : (
                    <span className="text-destructive font-semibold">не найден в CRM</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Оплат проживания" value={String(preview.stats.guestPayments)} />
            <Stat label="Уникальных гостей" value={String(preview.stats.uniqueGuests)} />
            <Stat label="Прочих операций" value={String(preview.stats.otherTransactions)} />
            <Stat label="Сейчас живут" value={String(preview.stats.livingGuests)} />
            <Stat label="Доход (файл)" value={money(preview.stats.incomeTotal)} />
            <Stat label="Расход (файл)" value={money(preview.stats.expenseTotal)} />
            <Stat label="Нулевые оплаты" value={String(preview.stats.zeroPayments)} />
            <Stat
              label="Мест сопоставлено"
              value={`${preview.placeMatches.filter((p) => p.method !== "unmatched").length}/${preview.placeMatches.length}`}
            />
          </div>

          {preview.dateRange && (
            <p className="text-muted-foreground">
              Период оплат: {preview.dateRange.from} — {preview.dateRange.to}
            </p>
          )}

          {preview.virtualPlaces.length > 0 && (
            <p className="text-muted-foreground text-[11px]">
              Виртуальные места ({preview.virtualPlaces.length}): при импорте назначится первый доступный номер.
            </p>
          )}

          {preview.unmatchedPlaces.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200">
              <div className="font-semibold mb-1">Не сопоставлены места ({preview.unmatchedPlaces.length})</div>
              <div className="text-[11px] break-words">
                {preview.unmatchedPlaces.slice(0, 20).join(", ")}
                {preview.unmatchedPlaces.length > 20 ? "…" : ""}
              </div>
              <p className="text-[11px] mt-1 opacity-80">
                Проверьте номера/койки в номерном фонде или включите AITUNNEL_API_KEY для умного сопоставления.
              </p>
            </div>
          )}

          {preview.unmatchedHotels.length > 0 && (
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive font-semibold">
              Сначала создайте отели с названиями как в Excel: {preview.unmatchedHotels.join(", ")}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border p-4 space-y-2 text-[12px]">
          <div className="font-bold text-success flex items-center gap-2">
            <CheckCircle2 size={16} />
            Импорт завершён — создано {createdTotal}, пропущено {skippedTotal}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(result.created).map(([k, v]) => (
              <span key={k}>
                {LABELS[k] ?? k}: <b>+{v}</b>
              </span>
            ))}
          </div>
          {result.warnings.length > 0 && (
            <ul className="text-amber-700 dark:text-amber-300 space-y-1">
              {result.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-black text-[14px]">{value}</div>
    </div>
  );
}
