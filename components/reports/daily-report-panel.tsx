"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Unlock, FileCheck, Loader2, Copy, Check } from "lucide-react";
import { Icon } from "@/components/icon";
import { DatePicker } from "@/components/ui/date-picker";
import { money, fmtDate } from "@/lib/format";
import { mskDateKey, fmtMskDateTime } from "@/lib/msk-time";
import type { DailyPmBreakdown } from "@/lib/daily-report";
import { formatDailyReportText } from "@/lib/daily-report";

type HistoryItem = {
  id: string;
  date: string;
  cashClosing: number;
  grandTotal: number;
  closedAt: string;
};

type ReportData = {
  date: string;
  dayAdminName: string;
  nightAdminName: string;
  occupancy: number;
  cashOpening: number;
  cashClosing: number;
  accommodationTotal: number;
  grandTotal: number;
  expensesTotal: number;
  expenseOnlyTotal?: number;
  encashmentTotal?: number;
  byPayment: DailyPmBreakdown[];
  closedAt?: string;
};

type PaymentLock = {
  locked: boolean;
  message: string | null;
  unlockAt: string | null;
};

export function DailyReportPanel({
  hotelId,
  hotelName,
  pmConfig,
  canReopenReport,
  onClosed,
}: {
  hotelId: string;
  hotelName: string;
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  canReopenReport?: boolean;
  onClosed?: () => void;
}) {
  const todayKey = useMemo(() => mskDateKey(), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [paymentLock, setPaymentLock] = useState<PaymentLock>({ locked: false, message: null, unlockAt: null });

  const loadReport = useCallback(async (date: string) => {
    setLoading(true);
    setError("");
    try {
      const [reportRes, lockRes] = await Promise.all([
        fetch(`/api/daily-reports?hotelId=${hotelId}&date=${date}`),
        fetch(`/api/payment-lock?hotelId=${hotelId}`),
      ]);
      if (!reportRes.ok) {
        const err = await reportRes.json().catch(() => ({}));
        setError(err.error || "Не удалось загрузить отчёт");
        return;
      }
      const data = await reportRes.json();
      setClosed(Boolean(data.closed));
      setReport(data.report);
      if (lockRes.ok) setPaymentLock(await lockRes.json());
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/daily-reports?hotelId=${hotelId}`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.history ?? []);
    }
  }, [hotelId]);

  useEffect(() => {
    loadHistory();
    loadReport(selectedDate);
  }, [hotelId, selectedDate, loadHistory, loadReport]);

  async function closeReport() {
    setClosing(true);
    setError("");
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId, date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось закрыть отчёт");
        return;
      }
      setClosed(true);
      setReport(data.report);
      await loadHistory();
      const lockRes = await fetch(`/api/payment-lock?hotelId=${hotelId}`);
      if (lockRes.ok) setPaymentLock(await lockRes.json());
      onClosed?.();
    } finally {
      setClosing(false);
    }
  }

  async function reopenReport() {
    if (!window.confirm("Разблокировать день? Снова можно будет проводить оплаты и закрыть отчёт заново.")) {
      return;
    }
    setReopening(true);
    setError("");
    try {
      const res = await fetch(
        `/api/daily-reports?hotelId=${encodeURIComponent(hotelId)}&date=${encodeURIComponent(selectedDate)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось разблокировать отчёт");
        return;
      }
      setClosed(false);
      setReport(data.report);
      await loadHistory();
      const lockRes = await fetch(`/api/payment-lock?hotelId=${hotelId}`);
      if (lockRes.ok) setPaymentLock(await lockRes.json());
      onClosed?.();
    } finally {
      setReopening(false);
    }
  }

  const canClose = !closed && selectedDate <= todayKey;

  const paymentLabels = useMemo(
    () => Object.fromEntries(Object.entries(pmConfig).map(([code, cfg]) => [code, cfg.label])),
    [pmConfig]
  );

  async function copyReport() {
    if (!report || !closed) return;
    const text = formatDailyReportText(hotelName, selectedDate, report, paymentLabels, report.closedAt);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Не удалось скопировать в буфер обмена");
      }
    }
  }

  const closingToday = canClose && selectedDate === todayKey;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <aside className="lg:w-56 shrink-0 bg-card rounded-xl border border-border p-3 max-h-[520px] overflow-y-auto custom-scrollbar">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          История отчётов
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(todayKey)}
          className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-semibold mb-1 transition-colors ${
            selectedDate === todayKey ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
          }`}
        >
          Сегодня ({fmtDate(new Date(todayKey), true)})
        </button>
        {history.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setSelectedDate(h.date)}
            className={`w-full text-left px-3 py-2 rounded-lg text-[12px] mb-1 transition-colors ${
              selectedDate === h.date ? "bg-primary/10 text-primary" : "hover:bg-muted"
            }`}
          >
            <div className="font-semibold text-foreground">{fmtDate(new Date(h.date), true)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Касса {money(h.cashClosing)} · {money(h.grandTotal)}
            </div>
          </button>
        ))}
        {history.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-2 py-3">Закрытых отчётов пока нет</p>
        )}
      </aside>

      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[12px] font-bold text-muted-foreground block mb-1">Дата отчёта</label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                mode="iso"
                max={todayKey}
                className="[&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[13px] [&_button]:rounded-lg"
              />
            </div>
            <div className="flex gap-3 text-[12px]">
              <div className="px-3 py-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
                <span className="text-muted-foreground">Ночь: </span>
                <span className="font-bold text-[#2563EB]">{report?.nightAdminName || "—"}</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
                <span className="text-muted-foreground">День: </span>
                <span className="font-bold text-[#D97706]">{report?.dayAdminName || "—"}</span>
              </div>
              <Link href="/schedule" className="self-center text-[11px] font-bold text-primary hover:underline">
                Из графика →
              </Link>
            </div>
          </div>

          {closed ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyReport}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? "Скопировано" : "Скопировать"}
              </button>
              {canReopenReport && (
                <button
                  type="button"
                  onClick={reopenReport}
                  disabled={reopening || loading}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-50 transition-colors"
                >
                  {reopening ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  {reopening ? "Разблокировка…" : "Разблокировать день"}
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-success px-3 py-1.5 rounded-lg bg-success/10">
                <FileCheck size={14} /> Закрыт
                {report?.closedAt && (
                  <span className="font-normal text-muted-foreground">
                    {fmtMskDateTime(new Date(report.closedAt))}
                  </span>
                )}
              </span>
            </div>
          ) : canClose ? (
            <button
              type="button"
              onClick={closeReport}
              disabled={closing || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              {closing ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
              {closing ? "Закрытие…" : "Закрыть отчёт"}
            </button>
          ) : null}
        </div>

        {paymentLock.locked && selectedDate === todayKey && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2 text-[12px]">
            <Lock size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-200">Операции с деньгами закрыты</p>
              <p className="text-muted-foreground mt-0.5">{paymentLock.message}</p>
            </div>
          </div>
        )}

        {closingToday && !closed && (
          <div className="rounded-xl border border-blue-300/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-[12px]">
            <p className="font-bold text-blue-800 dark:text-blue-200">Закрытие отчёта за сегодня</p>
            <p className="text-muted-foreground mt-0.5">
              В отчёт войдут операции, признанные на сегодня (включая OTA после выезда). После закрытия до 00:01 МСК
              нельзя проводить оплаты, услуги, расходы, инкассацию и зарплаты.
            </p>
          </div>
        )}

        {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Загрузка отчёта…
          </div>
        ) : report ? (
          <>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Загрузка</div>
              <div className="text-[28px] font-black text-primary">{report.occupancy}%</div>
              <div className="text-[11px] text-muted-foreground mt-1">{hotelName}</div>
            </div>

            <div className="bg-card rounded-xl p-5 border border-border space-y-4">
              <section>
                <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-3">
                  Выручка по способам оплаты
                </h4>
                <table className="w-full table-fixed text-[11px] sm:text-[12px]">
                  <thead>
                    <tr className="text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase border-b border-border">
                      <th className="text-left py-1.5 sm:py-2 pr-1 sm:pr-4 w-[44%]">Способ</th>
                      <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[28%]">Гости</th>
                      <th className="text-right py-1.5 sm:py-2 pl-0.5 sm:pl-2 w-[28%]">Всего</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byPayment.map((row) => {
                      if (row.accommodation === 0 && row.total === 0) return null;
                      const cfg = pmConfig[row.code] ?? { label: row.code, color: "#64748B", icon: "Banknote" };
                      return (
                        <tr key={row.code} className="border-b border-border/40">
                          <td className="py-1.5 sm:py-2.5 pr-1 sm:pr-4">
                            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                              <Icon name={cfg.icon} size={12} style={{ color: cfg.color }} />
                              <span className="font-semibold truncate" style={{ color: cfg.color }}>{cfg.label}</span>
                            </div>
                          </td>
                          <td className="text-right py-1.5 sm:py-2.5 px-0.5 sm:px-2 font-bold text-success tabular-nums">{money(row.accommodation)}</td>
                          <td className="text-right py-1.5 sm:py-2.5 pl-0.5 sm:pl-2 font-black tabular-nums">{money(row.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-1">Выручка гости</h4>
                  <div className="text-[20px] font-black text-success">{money(report.accommodationTotal)}</div>
                </div>
                <div>
                  <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-1">Общая выручка</h4>
                  <div className="text-[20px] font-black text-foreground">{money(report.grandTotal)}</div>
                </div>
              </section>

              <section className="pt-2 border-t border-border">
                <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-1">Расходы</h4>
                <div className="text-[20px] font-black text-destructive">−{money(report.expensesTotal)}</div>
                {(report.encashmentTotal ?? 0) > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    в т.ч. инкассация −{money(report.encashmentTotal ?? 0)}
                    {(report.expenseOnlyTotal ?? 0) > 0 && `, прочие расходы −${money(report.expenseOnlyTotal ?? 0)}`}
                  </p>
                )}
              </section>

              <section className="pt-3 border-t-2 border-primary/30">
                <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-1">Итого денег в кассе</h4>
                <div className="text-[26px] font-black text-primary">{money(report.cashClosing)}</div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
