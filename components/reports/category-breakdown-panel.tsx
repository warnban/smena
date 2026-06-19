"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { money } from "@/lib/format";
import {
  expenseAmount,
  isExpenseType,
  isTransactionRecognized,
  revenueAmount,
  transactionInReportMonth,
} from "@/lib/finance";
import { txCategoryLabel } from "@/lib/tx-categories";
import type { Booking, Transaction, TransactionCategoryDef } from "@/lib/types";
import { categoryLabel } from "@/lib/transaction-categories";

type Direction = "income" | "expense";

const TX_BUILTIN = new Set([
  "accommodation",
  "breakfast",
  "laundry",
  "slippers",
  "minibar",
  "parking",
  "transfer_srv",
  "sauna",
  "extra",
  "encashment",
  "salary",
  "bonus",
]);

function categoryDisplayLabel(code: string, custom: TransactionCategoryDef[]): string {
  if (TX_BUILTIN.has(code)) return txCategoryLabel(code);
  return categoryLabel(code, custom);
}

function aggregateByCategory(
  transactions: Transaction[],
  bookings: Booking[],
  direction: Direction,
  year: number,
  month: number,
  customCategories: TransactionCategoryDef[]
) {
  const map = new Map<string, number>();

  for (const t of transactions) {
    if (!isTransactionRecognized(t, bookings)) continue;
    if (!transactionInReportMonth(t, bookings, year, month)) continue;

    const isExpense = isExpenseType(t.type);
    if (direction === "income" && isExpense) continue;
    if (direction === "expense" && !isExpense) continue;

    const amount = direction === "income" ? revenueAmount(t) : expenseAmount(t);
    if (amount <= 0) continue;

    map.set(t.category, (map.get(t.category) ?? 0) + amount);
  }

  return Array.from(map.entries())
    .map(([code, amount]) => ({
      code,
      label: categoryDisplayLabel(code, customCategories),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function CategoryBreakdownPanel({
  transactions,
  bookings,
  transactionCategories,
  onCategoryClick,
}: {
  transactions: Transaction[];
  bookings: Booking[];
  transactionCategories: TransactionCategoryDef[];
  onCategoryClick: (direction: Direction, category: string) => void;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const [direction, setDirection] = useState<Direction>("income");

  const rows = useMemo(
    () => aggregateByCategory(transactions, bookings, direction, year, month, transactionCategories),
    [transactions, bookings, direction, year, month, transactionCategories]
  );

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Детализация по категориям</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex gap-2">
          {([
            ["income", "Доход"],
            ["expense", "Расход"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDirection(id)}
              className="px-3 py-1.5 text-[12px] font-bold rounded-lg border transition-all"
              style={{
                borderColor:
                  direction === id
                    ? id === "income"
                      ? "#10B981"
                      : "#EF4444"
                    : "hsl(var(--border))",
                background:
                  direction === id
                    ? id === "income"
                      ? "#ECFDF5"
                      : "#FEF2F2"
                    : undefined,
                color:
                  direction === id
                    ? id === "income"
                      ? "#059669"
                      : "#DC2626"
                    : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-6 text-center">
          Нет {direction === "income" ? "доходов" : "расходов"} за выбранный период
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => {
            const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
            return (
              <button
                key={row.code}
                type="button"
                onClick={() => onCategoryClick(direction, row.code)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-foreground truncate">{row.label}</span>
                    <span
                      className="text-[13px] font-black flex-shrink-0"
                      style={{ color: direction === "income" ? "#059669" : "#DC2626" }}
                    >
                      {money(row.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: direction === "income" ? "#10B981" : "#EF4444",
                      }}
                    />
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                />
              </button>
            );
          })}
          <div className="flex items-center justify-between px-3 pt-2 border-t border-border mt-2">
            <span className="text-[12px] font-bold text-muted-foreground">Итого</span>
            <span
              className="text-[14px] font-black"
              style={{ color: direction === "income" ? "#059669" : "#DC2626" }}
            >
              {money(total)}
            </span>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-3">Нажмите на категорию, чтобы открыть транзакции с фильтром</p>
    </div>
  );
}
