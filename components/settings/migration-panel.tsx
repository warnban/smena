"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { BotNetworkListItem } from "@/lib/migration/bot-types";

type PreviewStats = {
  guestCount: number;
  transactionCount: number;
  incomeTotal: number;
  expenseTotal: number;
  livingCount: number;
};

type ImportResult = {
  created: Record<string, number>;
  skipped: Record<string, number>;
  reconciliation: {
    fromDate: string;
    botIncome: number;
    crmIncome: number;
    botExpense: number;
    crmExpense: number;
  };
};

const LABELS: Record<string, string> = {
  hotels: "Отели",
  rooms: "Комнаты",
  beds: "Койки",
  guests: "Гости",
  bookings: "Брони",
  transactions: "Транзакции",
  paymentMethods: "Способы оплаты",
};

export function MigrationPanel({ canEdit }: { canEdit: boolean }) {
  const [botUrl, setBotUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [fromDate, setFromDate] = useState("2025-06-01");
  const [networks, setNetworks] = useState<BotNetworkListItem[]>([]);
  const [networkId, setNetworkId] = useState("");
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [objectNames, setObjectNames] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canEdit) {
    return (
      <p className="text-[13px] text-muted-foreground">Импорт доступен только владельцу сети.</p>
    );
  }

  async function loadNetworks() {
    setError("");
    setResult(null);
    setStats(null);
    setBusy(true);
    try {
      const res = await fetch("/api/migration/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botUrl, secret, fromDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось подключиться");
        return;
      }
      setNetworks(data.networks ?? []);
      if (data.networks?.length === 1) {
        setNetworkId(data.networks[0].id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (!networkId) {
      setError("Выберите сеть");
      return;
    }
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/migration/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botUrl, secret, fromDate, networkId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка предпросмотра");
        return;
      }
      setStats(data.stats);
      setObjectNames(data.objectNames ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!networkId) {
      setError("Выберите сеть");
      return;
    }
    if (!confirm("Импортировать данные из старой CRM? Повторный запуск пропустит уже перенесённые записи.")) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/migration/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botUrl, secret, fromDate, networkId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка импорта");
        return;
      }
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  const incomeDiff = result
    ? result.reconciliation.crmIncome - result.reconciliation.botIncome
    : 0;
  const expenseDiff = result
    ? result.reconciliation.crmExpense - result.reconciliation.botExpense
    : 0;

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-[14px] font-black text-foreground flex items-center gap-2">
          <Download size={16} className="text-primary" />
          Импорт из старой CRM
        </h3>
        <p className="text-[12px] text-muted-foreground mt-1">
          Перенос хостелов, гостей, оплат с указанной даты. Долги и фиктивные оплаты не переносятся.
          На старом сервере должен быть задан тот же <code className="text-[11px]">MIGRATION_SECRET</code>.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">URL старой CRM</label>
          <input
            value={botUrl}
            onChange={(e) => setBotUrl(e.target.value)}
            placeholder="https://crm.example.ru"
            className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-card outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Ключ миграции</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="MIGRATION_SECRET"
            className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-card outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Данные с даты</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-card outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={busy || !botUrl || !secret}
            onClick={loadNetworks}
            className="px-3 py-2 text-[12px] font-bold rounded-xl border border-border hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Загрузка…" : "1. Загрузить сети"}
          </button>
          {networks.length > 0 && (
            <>
              <select
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                className="px-3 py-2 text-[12px] rounded-xl border border-border bg-card"
              >
                <option value="">Выберите сеть</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.objectCount} хост.)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !networkId}
                onClick={preview}
                className="px-3 py-2 text-[12px] font-bold rounded-xl border border-primary text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                2. Предпросмотр
              </button>
              <button
                type="button"
                disabled={busy || !networkId}
                onClick={runImport}
                className="px-3 py-2 text-[12px] font-bold rounded-xl text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}
              >
                {busy ? "Импорт…" : "3. Импортировать"}
              </button>
            </>
          )}
        </div>
      </div>

      {stats && (
        <div className="rounded-xl border border-border p-4 space-y-2 text-[12px]">
          <p className="font-bold text-foreground">Предпросмотр</p>
          <p className="text-muted-foreground">Хостелы: {objectNames.join(", ") || "—"}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>Гостей: <strong>{stats.guestCount}</strong></div>
            <div>Живёт сейчас: <strong>{stats.livingCount}</strong></div>
            <div>Транзакций: <strong>{stats.transactionCount}</strong></div>
            <div>Доход (bot): <strong>{stats.incomeTotal.toLocaleString("ru-RU")} ₽</strong></div>
            <div>Расход (bot): <strong>{stats.expenseTotal.toLocaleString("ru-RU")} ₽</strong></div>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3 text-[12px]">
          <p className="font-bold text-foreground flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-success" /> Импорт завершён
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(result.created).map(([k, v]) =>
              v > 0 ? (
                <span key={k} className="px-2 py-1 rounded-lg bg-card border border-border">
                  +{v} {LABELS[k] ?? k}
                </span>
              ) : null
            )}
          </div>
          <div className="rounded-lg bg-card border border-border p-3 space-y-1">
            <p className="font-semibold">Сверка с {result.reconciliation.fromDate}</p>
            <p>
              Доход: bot {result.reconciliation.botIncome.toLocaleString("ru-RU")} ₽ → CRM{" "}
              {result.reconciliation.crmIncome.toLocaleString("ru-RU")} ₽
              {incomeDiff !== 0 && (
                <span className={incomeDiff > 0 ? " text-warning" : " text-destructive"}>
                  {" "}
                  ({incomeDiff > 0 ? "+" : ""}
                  {incomeDiff.toLocaleString("ru-RU")} ₽)
                </span>
              )}
            </p>
            <p>
              Расход: bot {result.reconciliation.botExpense.toLocaleString("ru-RU")} ₽ → CRM{" "}
              {result.reconciliation.crmExpense.toLocaleString("ru-RU")} ₽
              {expenseDiff !== 0 && (
                <span className={expenseDiff > 0 ? " text-warning" : " text-destructive"}>
                  {" "}
                  ({expenseDiff > 0 ? "+" : ""}
                  {expenseDiff.toLocaleString("ru-RU")} ₽)
                </span>
              )}
            </p>
            {(Math.abs(incomeDiff) > 100 || Math.abs(expenseDiff) > 100) && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1 mt-2">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                Небольшие расхождения возможны из‑за округления и OTA. Проверьте отчёты за месяц.
              </p>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
      {busy && (
        <p className="text-[12px] text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Подождите…
        </p>
      )}
    </div>
  );
}
