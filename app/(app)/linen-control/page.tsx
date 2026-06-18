"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { DatePicker } from "@/components/ui/date-picker";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate } from "@/lib/format";
import { HK_CATEGORY_LABELS } from "@/lib/housekeeping";
import type { HkTaskCategory } from "@/lib/types";

type LinenStatus = "ok" | "warning" | "alert";

type LinenDelivery = {
  id: string;
  hotelId: string;
  deliveredAt: string;
  pillowcases: number;
  sheets: number;
  duvetCovers: number;
  washCost: number;
  isPaid: boolean;
  notes: string;
  invoicePath: string;
  invoiceName: string;
  invoiceSize: string;
  createdByName: string;
  createdAt: string;
};

type LinenOverview = {
  periodDays: number;
  from: string;
  to: string;
  settings: {
    pillowcasesPerChange: number;
    sheetsPerChange: number;
    duvetCoversPerChange: number;
    estimatedSets: number | null;
  };
  usage: {
    changesCount: number;
    byCategory: Record<string, number>;
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
  };
  delivered: {
    count: number;
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
    washCost: number;
  };
  variance: {
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
    status: LinenStatus;
    message: string;
  };
  estimatedStockEnd: number | null;
  recentDeliveries: LinenDelivery[];
  recentChanges: Array<{
    id: string;
    roomNumber: string;
    category: string;
    categoryLabel: string;
    completedAt: string;
  }>;
};

const STATUS_STYLE: Record<LinenStatus, { bg: string; border: string; text: string; icon: typeof CheckCircle2 }> = {
  ok: { bg: "#F0FDF4", border: "#A7F3D0", text: "#059669", icon: CheckCircle2 },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706", icon: AlertTriangle },
  alert: { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", icon: AlertTriangle },
};

const PERIODS = [14, 30, 60] as const;

function toInputDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayInputDate(): string {
  return toInputDate(new Date().toISOString());
}

/** Убирает markdown-разметку (**жирный**, *курсив*) из ответа AI */
function plainAiText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
}

export default function LinenControlPage() {
  const { hotelId, hotels, loading, canManageSettings } = useApp();
  const activeHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;
  const hotelName = hotels.find((h) => h.id === activeHotelId)?.name ?? "";

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [overview, setOverview] = useState<LinenOverview | null>(null);
  const [fetching, setFetching] = useState(true);
  const [aiCommentary, setAiCommentary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<LinenDelivery | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [paidToggleBusy, setPaidToggleBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    deliveredAt: todayInputDate(),
    pillowcases: "",
    sheets: "",
    duvetCovers: "",
    washCost: "",
    isPaid: false,
    notes: "",
  });
  const [formFile, setFormFile] = useState<File | null>(null);

  const [settings, setSettings] = useState({
    pillowcasesPerChange: 1,
    sheetsPerChange: 1,
    duvetCoversPerChange: 1,
    estimatedSets: "",
  });
  const [settingsBusy, setSettingsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeHotelId) {
      setOverview(null);
      setFetching(false);
      return;
    }
    setFetching(true);
    const res = await fetch(`/api/linen/overview?hotelId=${activeHotelId}&days=${periodDays}`);
    if (res.ok) {
      const data = await res.json();
      setOverview(data.overview ?? null);
      if (data.overview?.settings) {
        setSettings({
          pillowcasesPerChange: data.overview.settings.pillowcasesPerChange,
          sheetsPerChange: data.overview.settings.sheetsPerChange,
          duvetCoversPerChange: data.overview.settings.duvetCoversPerChange,
          estimatedSets:
            data.overview.settings.estimatedSets != null
              ? String(data.overview.settings.estimatedSets)
              : "",
        });
      }
    }
    setFetching(false);
  }, [activeHotelId, periodDays]);

  useEffect(() => {
    load();
  }, [load]);

  const statusStyle = overview ? STATUS_STYLE[overview.variance.status] : STATUS_STYLE.ok;
  const StatusIcon = statusStyle.icon;

  const comparisonRows = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Наволочки", used: overview.usage.pillowcases, delivered: overview.delivered.pillowcases },
      { label: "Простыни", used: overview.usage.sheets, delivered: overview.delivered.sheets },
      { label: "Пододеяльники", used: overview.usage.duvetCovers, delivered: overview.delivered.duvetCovers },
    ];
  }, [overview]);

  async function runAiAnalyze() {
    if (!activeHotelId || !canManageSettings) return;
    setAiBusy(true);
    setAiCommentary("");
    const res = await fetch("/api/linen/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId: activeHotelId, days: periodDays }),
    });
    const data = await res.json();
    if (res.ok) {
      setAiCommentary(plainAiText(data.commentary ?? ""));
      if (data.overview) setOverview(data.overview);
    } else {
      setAiCommentary(data.error ?? "Ошибка анализа");
    }
    setAiBusy(false);
  }

  async function saveSettings() {
    if (!activeHotelId || !canManageSettings) return;
    setSettingsBusy(true);
    await fetch("/api/linen/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: activeHotelId,
        pillowcasesPerChange: settings.pillowcasesPerChange,
        sheetsPerChange: settings.sheetsPerChange,
        duvetCoversPerChange: settings.duvetCoversPerChange,
        estimatedSets: settings.estimatedSets === "" ? null : settings.estimatedSets,
      }),
    });
    await load();
    setSettingsBusy(false);
  }

  async function submitDelivery() {
    if (!activeHotelId) return;
    setFormBusy(true);
    setFormError("");
    const fd = new FormData();
    fd.append("hotelId", activeHotelId);
    fd.append("deliveredAt", form.deliveredAt);
    fd.append("pillowcases", form.pillowcases || "0");
    fd.append("sheets", form.sheets || "0");
    fd.append("duvetCovers", form.duvetCovers || "0");
    fd.append("washCost", form.washCost || "0");
    if (form.isPaid) fd.append("isPaid", "1");
    fd.append("notes", form.notes);
    fd.append("periodDays", String(periodDays));
    if (formFile) {
      fd.append("file", formFile);
    }
    const res = await fetch("/api/linen/deliveries", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setShowForm(false);
      setFormFile(null);
      setForm({
        deliveredAt: todayInputDate(),
        pillowcases: "",
        sheets: "",
        duvetCovers: "",
        washCost: "",
        isPaid: false,
        notes: "",
      });
      if (data.overview) setOverview(data.overview);
      else await load();
    } else {
      setFormError(data.error ?? "Ошибка сохранения");
    }
    setFormBusy(false);
  }

  async function togglePaid(delivery: LinenDelivery) {
    setPaidToggleBusy(delivery.id);
    const res = await fetch(`/api/linen/deliveries/${delivery.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !delivery.isPaid }),
    });
    const data = await res.json();
    if (res.ok && data.delivery && overview) {
      setOverview({
        ...overview,
        recentDeliveries: overview.recentDeliveries.map((d) =>
          d.id === delivery.id ? { ...d, isPaid: data.delivery.isPaid } : d
        ),
      });
    }
    setPaidToggleBusy(null);
  }

  async function deleteDelivery(id: string) {
    if (!confirm("Удалить запись о доставке?")) return;
    const res = await fetch(`/api/linen/deliveries/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      if (data.overview) setOverview(data.overview);
      else await load();
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Контроль белья" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Контроль белья"
        subtitle={hotelId === "all" ? `${hotelName || "Выберите отель"}` : undefined}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {hotelId === "all" && (
          <p className="text-[12px] text-muted-foreground">
            Показан первый отель. Выберите конкретный отель в шапке для точного учёта.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Период сверки</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {PERIODS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPeriodDays(d)}
                  className={`px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    periodDays === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d} дн.
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={!activeHotelId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} /> Доставка от прачечной
          </button>
        </div>

        {fetching ? (
          <p className="text-center text-[13px] text-muted-foreground py-16">Загрузка данных…</p>
        ) : !overview ? (
          <p className="text-center text-[13px] text-muted-foreground py-16">Нет данных</p>
        ) : (
          <>
            <div
              className="rounded-xl border p-4 flex gap-3 items-start"
              style={{ background: statusStyle.bg, borderColor: statusStyle.border }}
            >
              <StatusIcon size={20} style={{ color: statusStyle.text, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-[13px] font-bold" style={{ color: statusStyle.text }}>
                  {overview.variance.status === "ok"
                    ? "В пределах нормы"
                    : overview.variance.status === "warning"
                      ? "Есть расхождения"
                      : "Требует проверки"}
                </p>
                <p className="text-[12px] text-foreground/80 mt-1">{overview.variance.message}</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {fmtDate(overview.from)} — {fmtDate(overview.to)} · расход считается по отмеченным уборкам
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Смен белья"
                value={String(overview.usage.changesCount)}
                sub="уборок «Готово»"
                accent="#2563EB"
              />
              <KpiCard
                label="Доставок"
                value={String(overview.delivered.count)}
                sub={`стирка ${money(overview.delivered.washCost)}`}
                accent="#7C3AED"
              />
              <KpiCard
                label="Разница"
                value={`${overview.variance.pillowcases >= 0 ? "+" : ""}${overview.variance.pillowcases}`}
                sub="наволочки (поставки − расход)"
                accent={overview.variance.pillowcases < 0 ? "#DC2626" : "#059669"}
              />
              <KpiCard
                label="Остаток ~"
                value={
                  overview.estimatedStockEnd != null ? String(overview.estimatedStockEnd) : "—"
                }
                sub="комплектов (если задан стартовый)"
                accent="#D97706"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/50">
                  <h2 className="text-[13px] font-bold">Сверка: расход vs поставки</h2>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-2 text-left font-bold">Позиция</th>
                      <th className="px-4 py-2 text-right font-bold">Расход</th>
                      <th className="px-4 py-2 text-right font-bold">Привезли</th>
                      <th className="px-4 py-2 text-right font-bold">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => {
                      const delta = row.delivered - row.used;
                      return (
                        <tr key={row.label} className="border-b border-border/60">
                          <td className="px-4 py-2.5 font-semibold">{row.label}</td>
                          <td className="px-4 py-2.5 text-right">{row.used}</td>
                          <td className="px-4 py-2.5 text-right">{row.delivered}</td>
                          <td
                            className="px-4 py-2.5 text-right font-bold"
                            style={{ color: delta < 0 ? "#DC2626" : delta > 0 ? "#059669" : undefined }}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-3 text-[11px] text-muted-foreground border-t border-border">
                  По категориям уборок:{" "}
                  {Object.entries(overview.usage.byCategory)
                    .map(([k, v]) => `${HK_CATEGORY_LABELS[k as HkTaskCategory] ?? k}: ${v}`)
                    .join(" · ") || "нет"}
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <h2 className="text-[13px] font-bold">Настройки расчёта</h2>
                <p className="text-[11px] text-muted-foreground">
                  На одну смену постельного (1 уборка «Готово») списывается указанное количество.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["pillowcasesPerChange", "Наволочки"],
                      ["sheetsPerChange", "Простыни"],
                      ["duvetCoversPerChange", "Пододеяльники"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
                      <input
                        type="number"
                        min={1}
                        disabled={!canManageSettings}
                        value={settings[key]}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [key]: Math.max(1, +e.target.value || 1) }))
                        }
                        className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-[13px] bg-background"
                      />
                    </label>
                  ))}
                </div>
                <label className="block">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Примерный остаток комплектов (необязательно)
                  </span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManageSettings}
                    value={settings.estimatedSets}
                    onChange={(e) => setSettings((s) => ({ ...s, estimatedSets: e.target.value }))}
                    placeholder="например 40"
                    className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-[13px] bg-background"
                  />
                </label>
                {canManageSettings && (
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={settingsBusy}
                    className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {settingsBusy ? "Сохранение…" : "Сохранить настройки"}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <h2 className="text-[13px] font-bold">AI-комментарий</h2>
                </div>
                {canManageSettings ? (
                  <button
                    type="button"
                    onClick={runAiAnalyze}
                    disabled={aiBusy || !activeHotelId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-bold hover:bg-muted disabled:opacity-50"
                  >
                    {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Bot" size={14} />}
                    {aiBusy ? "Анализ…" : "Получить рекомендации"}
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Доступно владельцу и управляющему</span>
                )}
              </div>
              {aiCommentary ? (
                <div className="text-[12px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {aiCommentary}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  AI проанализирует расхождения и подскажет, на что обратить внимание.
                </p>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                  <h2 className="text-[13px] font-bold">Журнал доставок</h2>
                  <span className="text-[11px] text-muted-foreground">{overview.recentDeliveries.length}</span>
                </div>
                {overview.recentDeliveries.length === 0 ? (
                  <p className="text-center text-[12px] text-muted-foreground py-10">Доставок пока нет</p>
                ) : (
                  <div className="divide-y divide-border max-h-[420px] overflow-auto">
                    {overview.recentDeliveries.map((d) => (
                      <div key={d.id} className="px-4 py-3 flex gap-3 items-center hover:bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-bold">{fmtDate(d.deliveredAt)}</p>
                            <button
                              type="button"
                              onClick={() => togglePaid(d)}
                              disabled={paidToggleBusy === d.id}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                                d.isPaid
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/15"
                              }`}
                              title={d.isPaid ? "Снять отметку оплаты" : "Отметить как оплачено"}
                            >
                              {paidToggleBusy === d.id ? "…" : d.isPaid ? "Оплачено" : "Не оплачено"}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Н {d.pillowcases} · П {d.sheets} · Под {d.duvetCovers}
                          </p>
                          {d.notes && (
                            <p className="text-[11px] text-foreground/70 mt-1 truncate">{d.notes}</p>
                          )}
                          {d.createdByName && (
                            <p className="text-[10px] text-muted-foreground mt-1">{d.createdByName}</p>
                          )}
                        </div>
                        {d.washCost > 0 && (
                          <p
                            className={`text-[16px] font-black shrink-0 tabular-nums ${
                              d.isPaid ? "text-foreground" : "text-amber-700"
                            }`}
                          >
                            {money(d.washCost)}
                          </p>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          {d.invoicePath && (
                            <button
                              type="button"
                              onClick={() => setPreview(d)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                              title="Накладная"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteDelivery(d.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/50">
                  <h2 className="text-[13px] font-bold">Последние смены белья</h2>
                </div>
                {overview.recentChanges.length === 0 ? (
                  <p className="text-center text-[12px] text-muted-foreground py-10">
                    Нет завершённых уборок за период
                  </p>
                ) : (
                  <div className="divide-y divide-border max-h-[420px] overflow-auto">
                    {overview.recentChanges.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[13px] font-bold">№{c.roomNumber}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">{c.categoryLabel}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {fmtDate(c.completedAt, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-[14px] font-bold">Доставка от прачечной</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Дата доставки</span>
                <div className="mt-1">
                  <DatePicker
                    mode="iso"
                    value={form.deliveredAt}
                    onChange={(v) => setForm((f) => ({ ...f, deliveredAt: v }))}
                    placeholder="Дата доставки"
                    className="w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl"
                  />
                </div>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["pillowcases", "Наволочки"],
                    ["sheets", "Простыни"],
                    ["duvetCovers", "Пододеяльники"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-[13px]"
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Сумма стирки, ₽</span>
                <input
                  type="number"
                  min={0}
                  value={form.washCost}
                  onChange={(e) => setForm((f) => ({ ...f, washCost: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px]"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-[12px] font-semibold text-foreground">Оплачено</span>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Комментарий</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] resize-none"
                />
              </label>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Накладная (фото/PDF)</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-bold hover:bg-muted"
                  >
                    <Upload size={14} />
                    {formFile ? formFile.name.slice(0, 24) : "Выбрать файл"}
                  </button>
                </div>
              </div>
              {formError && <p className="text-[12px] text-destructive">{formError}</p>}
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-2 rounded-lg text-[12px] font-bold text-muted-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submitDelivery}
                disabled={formBusy}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold disabled:opacity-50"
              >
                {formBusy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview?.invoicePath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-card rounded-xl border border-border max-w-3xl w-full max-h-[85vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold">{preview.invoiceName || "Накладная"}</p>
              <button type="button" onClick={() => setPreview(null)} className="p-1 rounded hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            {preview.invoiceName?.toLowerCase().endsWith(".pdf") ? (
              <a
                href={preview.invoicePath}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-bold text-primary hover:underline"
              >
                Открыть PDF
              </a>
            ) : (
              <img
                src={preview.invoicePath}
                alt={preview.invoiceName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg mx-auto"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
