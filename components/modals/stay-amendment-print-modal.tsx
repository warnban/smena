"use client";

import { useEffect, useState } from "react";
import { X, Printer, FileText, AlertTriangle } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import {
  GUEST_FORM_TEMPLATES,
  STAY_AMENDMENT_FORM_ID,
  buildStayAmendmentPrintUrl,
  type StayAmendmentPrevious,
} from "@/lib/guest-print-forms";

export function StayAmendmentPrintModal({
  guestId,
  guestName,
  bookingId,
  previous,
  newCheckOut,
  newAmount,
  nightDelta,
  amountDelta,
  onClose,
}: {
  guestId: string;
  guestName: string;
  bookingId: string;
  previous: StayAmendmentPrevious;
  newCheckOut: Date | string;
  newAmount: number;
  nightDelta: number;
  amountDelta: number;
  onClose: () => void;
}) {
  const [templateReady, setTemplateReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printBusy, setPrintBusy] = useState(false);

  const extended = nightDelta > 0;
  const meta = GUEST_FORM_TEMPLATES[STAY_AMENDMENT_FORM_ID];

  useEffect(() => {
    let cancelled = false;

    async function checkTemplate() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/guests/${guestId}/forms/${STAY_AMENDMENT_FORM_ID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            amendment: {
              prevCheckOut: new Date(previous.checkOut).toISOString().slice(0, 10),
              prevAmount: previous.amount,
              prevNights: previous.nights,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setError(String(data.error ?? "Не удалось проверить шаблон"));
            setTemplateReady(false);
          }
          return;
        }
        if (!cancelled) {
          setTemplateReady(Boolean(data.templateReady));
          if (!data.templateReady) {
            setError(`Шаблон «${meta.filename}» не найден. Запустите npm run generate:hotel-contract-amendment`);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Ошибка сети");
          setTemplateReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkTemplate();
    return () => {
      cancelled = true;
    };
  }, [guestId, bookingId, previous, meta.filename]);

  function printDocument() {
    if (!templateReady) return;
    setPrintBusy(true);
    const url = buildStayAmendmentPrintUrl({
      guestId,
      bookingId,
      previous,
      autoPrint: true,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    setPrintBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
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
              <h2 className="text-[14px] font-bold truncate">{meta.label}</h2>
              <p className="text-[11px] text-muted-foreground truncate">{guestName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Срок проживания изменён. Оформите дополнительное соглашение к договору на оказание гостиничных услуг
            (ст. 450, 452 ГК РФ; ст. 8–10, 22 ЗоЗПП; ПП РФ № 1853).
          </p>

          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-[12px]">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Было</span>
              <span className="font-semibold text-right">
                до {fmtDate(new Date(previous.checkOut))} · {previous.nights} сут. · {money(previous.amount)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Стало</span>
              <span className="font-semibold text-right">
                до {fmtDate(new Date(newCheckOut))} · {money(newAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-border">
              <span className="text-muted-foreground">{extended ? "Продление" : "Сокращение"}</span>
              <span className="font-bold text-primary">
                {nightDelta > 0 ? "+" : ""}{nightDelta} сут. · {amountDelta > 0 ? "+" : ""}{money(Math.abs(amountDelta))}
              </span>
            </div>
          </div>

          {!extended && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              При сокращении срока переплату оформите через «Возврат» на дашборде (ст. 22 ЗоЗПП).
            </div>
          )}

          {loading && <p className="text-[12px] text-muted-foreground text-center">Проверка шаблона…</p>}
          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
          {templateReady && !error && (
            <p className="text-[12px] text-success font-semibold">Шаблон готов к печати</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-wrap gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[100px] py-2.5 text-[13px] font-semibold rounded-xl bg-muted"
          >
            Позже
          </button>
          <button
            type="button"
            onClick={printDocument}
            disabled={loading || !templateReady || printBusy}
            className="flex items-center justify-center gap-1.5 flex-1 min-w-[140px] py-2.5 text-[13px] font-bold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50"
          >
            <Printer size={14} />
            {printBusy ? "…" : "Распечатать"}
          </button>
        </div>
      </div>
    </div>
  );
}
