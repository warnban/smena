"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Icon } from "@/components/icon";
import { money } from "@/lib/format";
import {
  buildMonthComparison,
  buildMonthOptions,
  currentMonthKey,
  monthKeyToString,
  monthLabel,
  monthLabelShort,
  parseMonthKey,
  previousMonthKey,
  type ComparisonRow,
  type ComparisonRowKind,
} from "@/lib/month-comparison";
import type { Booking, Transaction } from "@/lib/types";
import { Select } from "@/components/ui/select";

function DiffCell({ left, right, kind }: { left: number; right: number; kind: ComparisonRowKind }) {
  const diff = right - left;
  if (diff === 0) {
    return <span className="text-[10px] sm:text-[12px] text-muted-foreground">0 ₽</span>;
  }
  const up = diff > 0;
  const isExpense = kind === "expense-total" || kind === "expense-cat";
  const isGood = isExpense ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] sm:text-[12px] font-bold ${isGood ? "text-success" : "text-destructive"}`}
    >
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {money(Math.abs(diff))}
    </span>
  );
}

function ValueCell({ value, color }: { value: number; color: string }) {
  return (
    <span className="text-[11px] sm:text-[13px] font-black tabular-nums" style={{ color }}>
      {money(value)}
    </span>
  );
}

function ComparisonTableRow({ row }: { row: ComparisonRow }) {
  const isSub = row.kind === "income-cat" || row.kind === "expense-cat";
  const isBalance = row.kind === "balance";
  const isIncomeTotal = row.kind === "income-total";
  const isExpenseTotal = row.kind === "expense-total";

  const labelClass = isBalance
    ? "font-black text-foreground"
    : isIncomeTotal
      ? "font-bold text-success"
      : isExpenseTotal
        ? "font-bold text-destructive"
        : "text-muted-foreground";

  return (
    <tr className={isBalance ? "border-t-2 border-border" : "border-b border-border/40"}>
      <td className={`py-1.5 sm:py-2.5 pr-1 sm:pr-3 text-[10px] sm:text-[12px] ${labelClass} ${isSub ? "pl-3 sm:pl-5" : ""}`}>
        {row.label}
      </td>
      <td className="py-1.5 sm:py-2.5 px-0.5 sm:px-2 text-right">
        <ValueCell value={row.left} color="#2563EB" />
      </td>
      <td className="py-1.5 sm:py-2.5 px-0.5 sm:px-2 text-right">
        <ValueCell value={row.right} color="#D97706" />
      </td>
      <td className="py-1.5 sm:py-2.5 pl-0.5 sm:pl-2 text-right">
        <DiffCell left={row.left} right={row.right} kind={row.kind} />
      </td>
    </tr>
  );
}

export function MonthComparisonPanel({
  hotelId,
  hotelName,
  transactions,
  bookings,
  pmConfig,
}: {
  hotelId: string;
  hotelName: string;
  transactions: Transaction[];
  bookings: Booking[];
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
}) {
  const monthOptions = useMemo(() => buildMonthOptions(24), []);
  const pmEntries = useMemo(() => Object.entries(pmConfig), [pmConfig]);
  const pmCodesKey = pmEntries.map(([code]) => code).join(",");

  const scopedTx = useMemo(
    () => transactions.filter((t) => t.hotelId === hotelId),
    [transactions, hotelId]
  );
  const scopedBookings = useMemo(
    () => bookings.filter((b) => b.hotelId === hotelId),
    [bookings, hotelId]
  );

  const current = currentMonthKey();
  const prev = previousMonthKey(current);

  const [leftMonth, setLeftMonth] = useState(monthKeyToString(prev));
  const [rightMonth, setRightMonth] = useState(monthKeyToString(current));
  const [selectedPm, setSelectedPm] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedPm((prevState) => {
      const next = { ...prevState };
      pmEntries.forEach(([code]) => {
        if (next[code] === undefined) next[code] = true;
      });
      return next;
    });
  }, [pmCodesKey]);

  const activePmCodes = useMemo(
    () => pmEntries.filter(([code]) => selectedPm[code] !== false).map(([code]) => code),
    [pmEntries, selectedPm]
  );

  const leftKey = parseMonthKey(leftMonth);
  const rightKey = parseMonthKey(rightMonth);

  const comparison = useMemo(() => {
    if (activePmCodes.length === 0 || !leftKey || !rightKey) return null;
    return buildMonthComparison(
      scopedTx,
      scopedBookings,
      leftKey,
      rightKey,
      activePmCodes
    );
  }, [scopedTx, scopedBookings, leftKey, rightKey, activePmCodes]);

  const leftLabel = leftKey ? monthLabel(leftKey) : "—";
  const rightLabel = rightKey ? monthLabel(rightKey) : "—";
  const leftLabelShort = leftKey ? monthLabelShort(leftKey) : "—";
  const rightLabelShort = rightKey ? monthLabelShort(rightKey) : "—";

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Отель: <span className="font-bold text-foreground">{hotelName}</span>
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[160px]">
          <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
            Первый месяц
          </label>
          <Select
            value={leftMonth}
            onChange={setLeftMonth}
            options={monthOptions.map((m) => {
              const key = monthKeyToString(m);
              return { value: key, label: monthLabel(m) };
            })}
            className="border-2 border-[#8B5CF6]/50 [&>button]:bg-card [&>button]:font-semibold"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
            Второй месяц
          </label>
          <Select
            value={rightMonth}
            onChange={setRightMonth}
            options={monthOptions.map((m) => {
              const key = monthKeyToString(m);
              return { value: key, label: monthLabel(m) };
            })}
            className="border-2 border-[#F59E0B]/50 [&>button]:bg-card [&>button]:font-semibold"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-[11px] font-bold text-muted-foreground uppercase mb-3">
          Способы оплаты
        </div>
        <div className="flex flex-wrap gap-2">
          {pmEntries.map(([code, cfg]) => {
            const on = selectedPm[code] !== false;
            return (
              <label
                key={code}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                  on ? "border-border bg-muted/40" : "border-border/50 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setSelectedPm((prev) => ({ ...prev, [code]: !on }))}
                  className="rounded border-border"
                />
                <Icon name={cfg.icon} size={13} style={{ color: cfg.color }} />
                <span className="text-[12px] font-semibold" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {activePmCodes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">
          Выберите хотя бы один способ оплаты для сравнения
        </p>
      ) : comparison ? (
        <div className="bg-card rounded-xl p-3 sm:p-5 border border-border">
          <table className="w-full table-fixed">
            <thead>
              <tr className="text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase border-b border-border">
                <th className="text-left py-1.5 sm:py-2 pr-1 sm:pr-3 w-[38%]">Категория</th>
                <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[20%]" style={{ color: "#2563EB" }}>
                  <span className="hidden sm:inline">{leftLabel}</span>
                  <span className="sm:hidden">{leftLabelShort}</span>
                </th>
                <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[20%]" style={{ color: "#D97706" }}>
                  <span className="hidden sm:inline">{rightLabel}</span>
                  <span className="sm:hidden">{rightLabelShort}</span>
                </th>
                <th className="text-right py-1.5 sm:py-2 pl-0.5 sm:pl-2 w-[22%]">Разн.</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <ComparisonTableRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
