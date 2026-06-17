import type { Booking, Transaction } from "@/lib/types";
import {
  expenseAmount,
  revenueAmount,
  transactionInReportMonth,
} from "@/lib/finance";
import { txCategoryLabel } from "@/lib/tx-categories";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export type MonthKey = { year: number; month: number };

export type ComparisonRowKind =
  | "income-total"
  | "income-cat"
  | "expense-total"
  | "expense-cat"
  | "balance";

export type ComparisonRow = {
  id: string;
  label: string;
  kind: ComparisonRowKind;
  left: number;
  right: number;
};

export type MonthComparisonResult = {
  left: MonthKey;
  right: MonthKey;
  rows: ComparisonRow[];
};

function sumCategoryRevenue(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    const amt = revenueAmount(t);
    if (amt === 0) continue;
    map[t.category] = (map[t.category] ?? 0) + amt;
  }
  return map;
}

function sumCategoryExpense(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    const amt = expenseAmount(t);
    if (amt === 0) continue;
    map[t.category] = (map[t.category] ?? 0) + amt;
  }
  return map;
}

function monthTransactions(
  transactions: Transaction[],
  bookings: Booking[],
  year: number,
  month: number,
  paymentMethods: string[]
): Transaction[] {
  const pmSet = new Set(paymentMethods);
  return transactions.filter(
    (t) =>
      pmSet.has(t.paymentMethod) &&
      transactionInReportMonth(t, bookings, year, month)
  );
}

export function monthLabel(key: MonthKey): string {
  return `${MONTH_NAMES[key.month]} ${key.year}`;
}

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Короткая подпись месяца для узких экранов. */
export function monthLabelShort(key: MonthKey): string {
  return `${MONTH_SHORT[key.month]} ${String(key.year).slice(-2)}`;
}

export function monthKeyToString(key: MonthKey): string {
  return `${key.year}-${String(key.month + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value: string): MonthKey | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11 || !Number.isFinite(year)) return null;
  return { year, month };
}

export function currentMonthKey(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function previousMonthKey(key: MonthKey): MonthKey {
  const d = new Date(key.year, key.month - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function buildMonthOptions(count = 24): MonthKey[] {
  const now = currentMonthKey();
  const options: MonthKey[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.year, now.month - i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return options;
}

export function buildMonthComparison(
  transactions: Transaction[],
  bookings: Booking[],
  left: MonthKey,
  right: MonthKey,
  paymentMethods: string[],
  categoryLabels?: Record<string, string>
): MonthComparisonResult {
  const label = (cat: string) =>
    categoryLabels ? (cat === "accommodation" ? "Гости" : (categoryLabels[cat] ?? cat)) : txCategoryLabel(cat);

  const leftTx = monthTransactions(transactions, bookings, left.year, left.month, paymentMethods);
  const rightTx = monthTransactions(transactions, bookings, right.year, right.month, paymentMethods);

  const leftIncome = leftTx.reduce((s, t) => s + revenueAmount(t), 0);
  const rightIncome = rightTx.reduce((s, t) => s + revenueAmount(t), 0);
  const leftExpense = leftTx.reduce((s, t) => s + expenseAmount(t), 0);
  const rightExpense = rightTx.reduce((s, t) => s + expenseAmount(t), 0);

  const leftIncomeCats = sumCategoryRevenue(leftTx);
  const rightIncomeCats = sumCategoryRevenue(rightTx);
  const leftExpenseCats = sumCategoryExpense(leftTx);
  const rightExpenseCats = sumCategoryExpense(rightTx);

  const rows: ComparisonRow[] = [
    {
      id: "income-total",
      label: "Доход",
      kind: "income-total",
      left: leftIncome,
      right: rightIncome,
    },
  ];

  const incomeCategories = Array.from(
    new Set([...Object.keys(leftIncomeCats), ...Object.keys(rightIncomeCats)])
  ).sort((a, b) => {
    const maxA = Math.max(leftIncomeCats[a] ?? 0, rightIncomeCats[a] ?? 0);
    const maxB = Math.max(leftIncomeCats[b] ?? 0, rightIncomeCats[b] ?? 0);
    return maxB - maxA;
  });

  for (const cat of incomeCategories) {
    const l = leftIncomeCats[cat] ?? 0;
    const r = rightIncomeCats[cat] ?? 0;
    if (l === 0 && r === 0) continue;
    rows.push({
      id: `income-${cat}`,
      label: label(cat),
      kind: "income-cat",
      left: l,
      right: r,
    });
  }

  rows.push({
    id: "expense-total",
    label: "Расход",
    kind: "expense-total",
    left: leftExpense,
    right: rightExpense,
  });

  const expenseCategories = Array.from(
    new Set([...Object.keys(leftExpenseCats), ...Object.keys(rightExpenseCats)])
  ).sort((a, b) => {
    const maxA = Math.max(leftExpenseCats[a] ?? 0, rightExpenseCats[a] ?? 0);
    const maxB = Math.max(leftExpenseCats[b] ?? 0, rightExpenseCats[b] ?? 0);
    return maxB - maxA;
  });

  for (const cat of expenseCategories) {
    const l = leftExpenseCats[cat] ?? 0;
    const r = rightExpenseCats[cat] ?? 0;
    if (l === 0 && r === 0) continue;
    rows.push({
      id: `expense-${cat}`,
      label: label(cat),
      kind: "expense-cat",
      left: l,
      right: r,
    });
  }

  rows.push({
    id: "balance",
    label: "Остаток",
    kind: "balance",
    left: leftIncome - leftExpense,
    right: rightIncome - rightExpense,
  });

  return { left, right, rows };
}
