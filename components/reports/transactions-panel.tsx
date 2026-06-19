"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { Icon } from "@/components/icon";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { TransactionDetailSheet } from "@/components/reports/transaction-detail-sheet";
import { CreateTransactionSheet } from "@/components/reports/create-transaction-sheet";
import { money } from "@/lib/format";
import { expenseAmount, isExpenseType, revenueAmount } from "@/lib/finance";
import {
  isTransactionCancelled,
  txAmountColor,
  txIsOutflow,
  txListSubtitle,
  txPartyLabel,
  txTypeLabel,
} from "@/lib/transaction-display";
import { fmtMskDayLabel, mskDateKey } from "@/lib/msk-time";
import { buildCategoryOptions } from "@/lib/transaction-categories";
import type { Hotel, Transaction, TransactionCategoryDef } from "@/lib/types";

const TX_PAGE_SIZE = 50;

export type TxFilterState = {
  direction: "all" | "income" | "expense";
  method: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  query: string;
};

export const DEFAULT_TX_FILTER: TxFilterState = {
  direction: "all",
  method: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
  query: "",
};

type TxListRow =
  | { kind: "day"; dayKey: string; label: string }
  | { kind: "tx"; tx: Transaction };

function matchesFilter(t: Transaction, filter: TxFilterState): boolean {
  if (filter.method !== "all" && t.paymentMethod !== filter.method) return false;
  if (filter.category !== "all" && t.category !== filter.category) return false;
  if (filter.direction === "income" && isExpenseType(t.type)) return false;
  if (filter.direction === "expense" && !isExpenseType(t.type)) return false;
  const key = mskDateKey(t.date);
  if (filter.dateFrom && key < filter.dateFrom) return false;
  if (filter.dateTo && key > filter.dateTo) return false;
  if (filter.query.trim()) {
    const q = filter.query.trim().toLowerCase();
    const hay = [t.guestName, t.note, t.roomNumber].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function isFilterActive(filter: TxFilterState): boolean {
  return (
    filter.direction !== "all" ||
    filter.method !== "all" ||
    filter.category !== "all" ||
    Boolean(filter.dateFrom) ||
    Boolean(filter.dateTo) ||
    Boolean(filter.query.trim())
  );
}

export function TransactionsPanel({
  transactions,
  hotels,
  hotelId,
  pmConfig,
  transactionCategories,
  canManageSettings,
  onRefresh,
  presetMethod,
  presetCategory,
  presetDirection,
}: {
  transactions: Transaction[];
  hotels: Hotel[];
  hotelId: string | "all";
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  transactionCategories: TransactionCategoryDef[];
  canManageSettings: boolean;
  onRefresh: () => Promise<void>;
  presetMethod?: string | null;
  presetCategory?: string | null;
  presetDirection?: "income" | "expense" | null;
}) {
  const [filter, setFilter] = useState<TxFilterState>(DEFAULT_TX_FILTER);
  const [txPage, setTxPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [txError, setTxError] = useState("");

  const pmMethodOptions = useMemo(
    () => [
      { value: "all", label: "Все способы оплаты" },
      ...Object.entries(pmConfig).map(([value, cfg]) => ({
        value,
        label: cfg.label,
        icon: cfg.icon,
        color: cfg.color,
        bg: cfg.bg,
      })),
    ],
    [pmConfig]
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Все категории" },
      ...buildCategoryOptions(transactionCategories).map((c) => ({
        value: c.code,
        label: c.label,
      })),
    ],
    [transactionCategories]
  );

  useEffect(() => {
    if (presetMethod) {
      setFilter((f) => ({ ...f, method: presetMethod }));
      setTxPage(1);
    }
  }, [presetMethod]);

  useEffect(() => {
    if (presetCategory || presetDirection) {
      setFilter((f) => ({
        ...f,
        ...(presetCategory ? { category: presetCategory } : {}),
        ...(presetDirection ? { direction: presetDirection } : {}),
      }));
      setTxPage(1);
    }
  }, [presetCategory, presetDirection]);

  useEffect(() => {
    setTxPage(1);
  }, [filter.direction, filter.method, filter.category, filter.dateFrom, filter.dateTo, filter.query, hotelId]);

  const filtTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter((t) => matchesFilter(t, filter)),
    [transactions, filter]
  );

  const txTotalPages = Math.max(1, Math.ceil(filtTxns.length / TX_PAGE_SIZE));

  useEffect(() => {
    if (txPage > txTotalPages) setTxPage(txTotalPages);
  }, [txPage, txTotalPages]);

  const paginatedTxns = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE;
    return filtTxns.slice(start, start + TX_PAGE_SIZE);
  }, [filtTxns, txPage]);

  const listRows = useMemo(() => {
    const rows: TxListRow[] = [];
    let prevKey = "";
    for (const t of paginatedTxns) {
      const key = mskDateKey(t.date);
      if (key !== prevKey) {
        rows.push({ kind: "day", dayKey: key, label: fmtMskDayLabel(t.date) });
        prevKey = key;
      }
      rows.push({ kind: "tx", tx: t });
    }
    return rows;
  }, [paginatedTxns]);

  const txRangeStart = filtTxns.length === 0 ? 0 : (txPage - 1) * TX_PAGE_SIZE + 1;
  const txRangeEnd = Math.min(txPage * TX_PAGE_SIZE, filtTxns.length);
  const filterActive = isFilterActive(filter);
  const netTotal = filtTxns.reduce((s, t) => s + revenueAmount(t) - expenseAmount(t), 0);

  function resetFilters() {
    setFilter(DEFAULT_TX_FILTER);
    setTxPage(1);
  }

  async function cancelTx(id: string) {
    setCancelBusyId(id);
    setTxError("");
    try {
      const res = await fetch(`/api/transactions/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTxError(data.error || "Не удалось отменить транзакцию");
        return;
      }
      setSelectedTx(null);
      await onRefresh();
    } finally {
      setCancelBusyId(null);
    }
  }

  function hotelNameFor(tx: Transaction) {
    return hotels.find((h) => h.id === tx.hotelId)?.name;
  }

  function openTx(tx: Transaction) {
    setSelectedTx(tx);
  }

  function renderTxRow(t: Transaction, compact: boolean) {
    const cancelled = isTransactionCancelled(t);
    const pmCfg = pmConfig[t.paymentMethod] ?? { label: t.paymentMethod, color: "#64748B", bg: "#F1F5F9", icon: "Banknote" };
    const isOut = txIsOutflow(t);
    const amountColor = txAmountColor(t, cancelled);
    const time = t.date.toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });

    if (compact) {
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => openTx(t)}
          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 active:bg-muted transition-colors border-b border-border/40 ${cancelled ? "opacity-60" : ""}`}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: pmCfg.bg }}>
            <Icon name={pmCfg.icon} size={15} style={{ color: pmCfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-foreground truncate">{txPartyLabel(t)}</span>
              <span
                className={`text-[14px] font-black flex-shrink-0 ${cancelled ? "line-through text-muted-foreground" : ""}`}
                style={amountColor ? { color: amountColor } : undefined}
              >
                {isOut ? "−" : "+"}{money(t.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground truncate">{txListSubtitle(t)}</span>
              <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">{time}</span>
            </div>
          </div>
        </button>
      );
    }

    return (
      <tr
        key={t.id}
        onClick={() => openTx(t)}
        className={`hover:bg-muted/50 border-b border-border/40 cursor-pointer ${cancelled ? "opacity-60" : ""}`}
      >
        <td className="px-4 py-2.5 text-[12px] text-foreground/80 font-mono whitespace-nowrap">{time}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full ${cancelled ? "bg-muted text-muted-foreground" : isOut ? "bg-destructive/10 text-destructive" : t.type === "service" ? "bg-accent text-primary" : "bg-success/10 text-success"}`}>
            {txTypeLabel(t.type)}
          </span>
          {cancelled && <span className="block text-[10px] font-bold text-muted-foreground uppercase mt-1">Отменена</span>}
        </td>
        <td className="px-4 py-2.5">
          <div className="text-[12px] font-semibold text-foreground">{txPartyLabel(t)}</div>
          {t.roomNumber && <div className="text-[10px] text-muted-foreground">№{t.roomNumber}</div>}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <Icon name={pmCfg.icon} size={12} style={{ color: pmCfg.color }} />
            <span className="text-[11px] font-semibold" style={{ color: pmCfg.color }}>{pmCfg.label}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-[13px] font-black text-right">
          <span className={cancelled ? "line-through text-muted-foreground" : ""} style={amountColor ? { color: amountColor } : undefined}>
            {isOut ? "−" : "+"} {money(t.amount)}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {canManageSettings && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
          >
            <Plus size={15} /> Новая транзакция
          </button>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter.query}
              onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
              placeholder="Плательщик, получатель, номер, примечание…"
              className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "Все"],
              ["income", "Доход"],
              ["expense", "Расход"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter((f) => ({ ...f, direction: id }))}
                className="px-3 py-1.5 text-[12px] font-bold rounded-lg border transition-all"
                style={{
                  borderColor: filter.direction === id ? (id === "income" ? "#10B981" : id === "expense" ? "#EF4444" : "#3B82F6") : "hsl(var(--border))",
                  background: filter.direction === id ? (id === "income" ? "#ECFDF5" : id === "expense" ? "#FEF2F2" : "#EFF6FF") : undefined,
                  color: filter.direction === id ? (id === "income" ? "#059669" : id === "expense" ? "#DC2626" : "#2563EB") : undefined,
                }}
              >
                {label}
              </button>
            ))}

            {filterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <RotateCcw size={12} /> Сбросить
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select
              size="sm"
              value={filter.method}
              onChange={(v) => setFilter((f) => ({ ...f, method: v }))}
              options={pmMethodOptions}
            />
            <Select
              size="sm"
              value={filter.category}
              onChange={(v) => setFilter((f) => ({ ...f, category: v }))}
              options={categoryOptions}
            />
            <DatePicker
              mode="iso"
              value={filter.dateFrom}
              onChange={(v) => setFilter((f) => ({ ...f, dateFrom: v }))}
              placeholder="Дата от"
              className="w-full"
            />
            <DatePicker
              mode="iso"
              value={filter.dateTo}
              onChange={(v) => setFilter((f) => ({ ...f, dateTo: v }))}
              placeholder="Дата до"
              min={filter.dateFrom || undefined}
              className="w-full"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border">
            <span className="text-[12px] font-bold text-foreground">
              Итого: <span style={{ color: netTotal >= 0 ? "#059669" : "#DC2626" }}>{money(netTotal)}</span>
            </span>
            {filtTxns.length > 0 && (
              <span className="text-[12px] text-muted-foreground font-semibold">{filtTxns.length} шт.</span>
            )}
          </div>
        </div>

        {txError && <p className="text-[12px] text-destructive font-semibold">{txError}</p>}

        {/* Mobile list */}
        <div className="md:hidden bg-card rounded-xl overflow-hidden border border-border">
          {listRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted-foreground">Нет транзакций</p>
          ) : (
            listRows.map((row) =>
              row.kind === "day" ? (
                <div key={`day-${row.dayKey}`} className="px-4 py-2 bg-muted/40 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-bold text-muted-foreground capitalize">{row.label}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </div>
              ) : (
                renderTxRow(row.tx, true)
              )
            )
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-card rounded-xl overflow-hidden border border-border">
          <table className="w-full">
            <thead className="bg-muted border-b-2 border-border sticky top-0 z-10">
              <tr>
                {["Время", "Тип", "Плательщик / получатель", "Способ", "Сумма"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase ${h === "Сумма" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listRows.map((row) =>
                row.kind === "day" ? (
                  <tr key={`day-${row.dayKey}`} className="bg-muted/40">
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[11px] font-bold text-muted-foreground capitalize whitespace-nowrap">{row.label}</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    </td>
                  </tr>
                ) : (
                  renderTxRow(row.tx, false)
                )
              )}
              {filtTxns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Нет транзакций</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtTxns.length > TX_PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              Показано {txRangeStart}–{txRangeEnd} из {filtTxns.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={txPage <= 1}
                onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-[12px] font-bold rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40"
              >
                ← Назад
              </button>
              <span className="text-[12px] font-semibold text-foreground min-w-[80px] text-center">
                {txPage} / {txTotalPages}
              </span>
              <button
                type="button"
                disabled={txPage >= txTotalPages}
                onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                className="px-3 py-1.5 text-[12px] font-bold rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailSheet
        tx={selectedTx}
        pmConfig={pmConfig}
        hotelName={selectedTx && hotelId === "all" ? hotelNameFor(selectedTx) : undefined}
        transactionCategories={transactionCategories}
        canManage={canManageSettings}
        cancelBusy={cancelBusyId === selectedTx?.id}
        onClose={() => setSelectedTx(null)}
        onCancel={cancelTx}
        onUpdated={onRefresh}
      />

      <CreateTransactionSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        hotels={hotels}
        hotelId={hotelId}
        pmConfig={pmConfig}
        transactionCategories={transactionCategories}
        canManageSettings={canManageSettings}
        onCreated={onRefresh}
      />
    </>
  );
}
