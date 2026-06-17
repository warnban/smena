"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Printer, FileText, ArrowRight, AlertTriangle } from "lucide-react";
import {
  CHECK_IN_PRINT_FORM_IDS,
  GUEST_FORM_TEMPLATES,
  buildGuestFormsPrintUrl,
  type GuestFormId,
} from "@/lib/guest-print-forms";

type FormStatus = {
  id: GuestFormId;
  label: string;
  templateReady: boolean;
  loading: boolean;
  error: string;
};

export function CheckInPrintModal({
  guestId,
  bookingId,
  guestName,
  onContinue,
  onClose,
}: {
  guestId: string;
  bookingId: string;
  guestName: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [statuses, setStatuses] = useState<FormStatus[]>(() =>
    CHECK_IN_PRINT_FORM_IDS.map((id) => ({
      id,
      label: GUEST_FORM_TEMPLATES[id].label,
      templateReady: false,
      loading: true,
      error: "",
    }))
  );
  const [printBusy, setPrintBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      const next = await Promise.all(
        CHECK_IN_PRINT_FORM_IDS.map(async (formId) => {
          try {
            const res = await fetch(`/api/guests/${guestId}/forms/${formId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              return {
                id: formId,
                label: GUEST_FORM_TEMPLATES[formId].label,
                templateReady: false,
                loading: false,
                error: (data.error as string) ?? "Не удалось загрузить",
              };
            }
            return {
              id: formId,
              label: GUEST_FORM_TEMPLATES[formId].label,
              templateReady: Boolean(data.templateReady),
              loading: false,
              error: "",
            };
          } catch {
            return {
              id: formId,
              label: GUEST_FORM_TEMPLATES[formId].label,
              templateReady: false,
              loading: false,
              error: "Ошибка сети",
            };
          }
        })
      );
      if (!cancelled) setStatuses(next);
    }

    void loadStatuses();
    return () => {
      cancelled = true;
    };
  }, [guestId, bookingId]);

  const loading = statuses.some((s) => s.loading);
  const readyCount = statuses.filter((s) => s.templateReady).length;
  const allReady = readyCount === CHECK_IN_PRINT_FORM_IDS.length;
  const anyReady = readyCount > 0;
  const missingTemplates = useMemo(
    () => statuses.filter((s) => !s.loading && !s.templateReady),
    [statuses]
  );

  function printAll() {
    if (!anyReady) return;
    setPrintBusy(true);
    const readyIds = statuses.filter((s) => s.templateReady).map((s) => s.id);
    const url = buildGuestFormsPrintUrl({
      guestId,
      bookingId,
      formIds: readyIds,
      autoPrint: true,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    setPrintBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold truncate">Документы при заселении</h2>
              <p className="text-[11px] text-muted-foreground truncate">{guestName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Распечатайте документы для подписания гостем, затем перейдите к оплате.
          </p>

          {loading ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">Проверка шаблонов…</p>
          ) : (
            <ul className="space-y-2">
              {statuses.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30"
                >
                  <FileText
                    size={16}
                    className={`flex-shrink-0 mt-0.5 ${s.templateReady ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">{s.label}</p>
                    {s.error && (
                      <p className="text-[11px] text-destructive mt-0.5">{s.error}</p>
                    )}
                    {!s.error && !s.templateReady && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5">
                        Шаблон не загружен — см. templates/guest-forms/
                      </p>
                    )}
                  </div>
                  {s.templateReady && (
                    <span className="text-[10px] font-bold text-success flex-shrink-0">Готов</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {missingTemplates.length > 0 && !loading && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                Не все шаблоны Word загружены. Будут напечатаны только доступные документы (
                {readyCount} из {CHECK_IN_PRINT_FORM_IDS.length}).
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-wrap gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[100px] py-2.5 text-[13px] font-semibold rounded-xl bg-muted"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={printAll}
            disabled={loading || !anyReady || printBusy}
            className="flex items-center justify-center gap-1.5 flex-1 min-w-[140px] py-2.5 text-[13px] font-bold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50"
          >
            <Printer size={14} />
            {printBusy ? "…" : allReady ? "Распечатать все" : `Печать (${readyCount})`}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex items-center justify-center gap-1.5 flex-1 min-w-[140px] py-2.5 text-[13px] font-bold rounded-xl text-white hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
          >
            Далее — оплата
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
