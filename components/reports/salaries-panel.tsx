"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, Banknote, Calculator, FileText, Gift, MinusCircle, PlusCircle, Users,
} from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { money } from "@/lib/format";
import { KPI_METRIC_LABELS } from "@/lib/kpi-bonus";
import { SHIFT_ROLE_LABELS, type ShiftRole } from "@/lib/schedule-salary";
import { fmtMskDateKey, mskDateKey } from "@/lib/msk-time";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";

type Summary = {
  staffId: string;
  staffName: string;
  role: string;
  shiftCount: number;
  accrued: number;
  paid: number;
  penalties: number;
  balance: number;
  shifts: { date: string; role: ShiftRole; amount: number; occupancy?: number; hkCount?: number }[];
};

type BonusLine = {
  id: string;
  staffId: string;
  amount: number;
  reason: string;
  isManual: boolean;
  included: boolean;
  staff: { id: string; name: string };
};

type BonusDraft = {
  id: string;
  periodMonth: string;
  status: string;
  kpiSnapshot: Record<string, number>;
  lines: BonusLine[];
};

type Receipt = {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  type: string;
  typeLabel: string;
  amount: number;
  paymentMethod: string;
  note: string;
};

type PanelTab = "salary" | "bonus" | "receipts";

export function SalariesPanel() {
  const { hotels, hotelId, pmConfig, staff, refresh } = useApp();
  const [tab, setTab] = useState<PanelTab>("salary");
  const [periodFrom, setPeriodFrom] = useState(() => {
    const key = mskDateKey();
    return `${key.slice(0, 8)}01`;
  });
  const [periodTo, setPeriodTo] = useState(() => mskDateKey());
  const [bonusMonth, setBonusMonth] = useState(() => mskDateKey().slice(0, 7));
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [payStaffId, setPayStaffId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  const [bonusDraft, setBonusDraft] = useState<BonusDraft | null>(null);
  const [bonusPaid, setBonusPaid] = useState<{ id: string; paidAt: string } | null>(null);

  const [manualStaffId, setManualStaffId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualPenalty, setManualPenalty] = useState(false);

  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";
  const pmEntries = Object.entries(pmConfig);
  const hotelStaff = useMemo(
    () => staff.filter((s) => s.hotelIds.includes(activeHotelId)),
    [staff, activeHotelId]
  );

  const loadSummaries = useCallback(async () => {
    if (!activeHotelId) return;
    setLoading(true);
    const res = await fetch(`/api/salaries?hotelId=${activeHotelId}&from=${periodFrom}&to=${periodTo}`);
    if (res.ok) {
      const data = await res.json();
      setSummaries(data.summaries ?? []);
      setCanManage(Boolean(data.canManage));
    }
    setLoading(false);
  }, [activeHotelId, periodFrom, periodTo]);

  const loadBonus = useCallback(async () => {
    if (!activeHotelId) return;
    const res = await fetch(`/api/salaries/bonus?hotelId=${activeHotelId}&periodMonth=${bonusMonth}`);
    if (res.ok) {
      const data = await res.json();
      setBonusDraft(data.draft ?? null);
      setBonusPaid(data.paidRun ?? null);
    }
  }, [activeHotelId, bonusMonth]);

  const loadReceipts = useCallback(async () => {
    if (!activeHotelId) return;
    const res = await fetch(`/api/salaries/receipts?hotelId=${activeHotelId}&from=${periodFrom}&to=${periodTo}`);
    if (res.ok) {
      const data = await res.json();
      setReceipts(data.receipts ?? []);
    }
  }, [activeHotelId, periodFrom, periodTo]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    if (tab === "bonus") void loadBonus();
  }, [tab, loadBonus]);

  useEffect(() => {
    if (tab === "receipts") void loadReceipts();
  }, [tab, loadReceipts]);

  async function paySalary(opts: { payAll?: boolean; staffId?: string; amount?: number }) {
    if (!activeHotelId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: activeHotelId,
          periodFrom,
          periodTo,
          paymentMethod: payMethod,
          note: payNote,
          kind: "salary",
          ...opts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка выплаты");
        return;
      }
      setPayAmount("");
      setPayNote("");
      await loadSummaries();
      await loadReceipts();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function calculateBonus() {
    if (!activeHotelId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salaries/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: activeHotelId, periodMonth: bonusMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось рассчитать");
        return;
      }
      setBonusDraft(data.run);
    } finally {
      setBusy(false);
    }
  }

  async function payBonus() {
    if (!bonusDraft) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salaries/bonus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", runId: bonusDraft.id, paymentMethod: payMethod, note: payNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка выплаты премии");
        return;
      }
      setPayNote("");
      await loadBonus();
      await loadReceipts();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addManualBonusLine() {
    if (!activeHotelId || !manualStaffId || !manualAmount || !manualReason) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salaries/bonus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          hotelId: activeHotelId,
          periodMonth: bonusMonth,
          staffId: manualStaffId,
          amount: Math.round(Number(manualAmount)),
          reason: manualReason,
          isPenalty: manualPenalty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      setManualAmount("");
      setManualReason("");
      await loadBonus();
    } finally {
      setBusy(false);
    }
  }

  const totalBalance = summaries.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const bonusTotal = bonusDraft?.lines.filter((l) => l.included && l.amount > 0).reduce((s, l) => s + l.amount, 0) ?? 0;

  if (!activeHotelId) {
    return (
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-[13px]">
        Выберите конкретный отель для расчёта зарплат.
      </div>
    );
  }

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; hide?: boolean }[] = [
    { id: "salary", label: "Зарплата", icon: <Banknote size={14} /> },
    { id: "bonus", label: "Премии", icon: <Award size={14} />, hide: !canManage },
    { id: "receipts", label: canManage ? "Чеки выплат" : "Мои чеки", icon: <FileText size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.filter((t) => !t.hide).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold border transition-all ${
              tab === t.id ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {(tab === "salary" || tab === "receipts") && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Период с</label>
            <DatePicker value={periodFrom} onChange={setPeriodFrom} mode="iso" className="[&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[12px]" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">по</label>
            <DatePicker value={periodTo} onChange={setPeriodTo} mode="iso" min={periodFrom} className="[&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[12px]" />
          </div>
          {tab === "salary" && (
            <p className="text-[12px] text-muted-foreground self-center">
              Начисление по <a href="/schedule" className="text-primary font-bold hover:underline">графику</a> и загрузке
            </p>
          )}
        </div>
      )}

      {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}

      {tab === "salary" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Сотрудников" value={String(summaries.length)} />
            <KpiCard label="К выплате" value={money(totalBalance)} accent="destructive" />
            <KpiCard label="Смен" value={String(summaries.reduce((s, r) => s + r.shiftCount, 0))} accent="primary" />
            <KpiCard label="Начислено" value={money(summaries.reduce((s, r) => s + r.accrued, 0))} accent="success" />
          </div>

          {canManage && (
            <div className="bg-card rounded-xl p-5 border border-border space-y-4">
              <h3 className="text-[13px] font-bold text-foreground flex items-center gap-2">
                <Banknote size={15} /> Выплата зарплаты
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Select
                  size="sm"
                  value={payStaffId}
                  onChange={(v) => {
                    setPayStaffId(v);
                    const s = summaries.find((x) => x.staffId === v);
                    if (s) setPayAmount(String(Math.max(0, s.balance)));
                  }}
                  placeholder="Сотрудник"
                  options={summaries.map((s) => ({ value: s.staffId, label: `${s.staffName} (${money(s.balance)})` }))}
                />
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Сумма" className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted" />
                <Select
                  size="sm"
                  value={payMethod}
                  onChange={setPayMethod}
                  options={pmEntries.map(([value, cfg]) => ({ value, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg }))}
                />
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Комментарий" className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy || !payStaffId || !payAmount} onClick={() => paySalary({ staffId: payStaffId, amount: Math.round(Number(payAmount)) })} className="px-4 py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">
                  Выплатить зарплату
                </button>
                <button disabled={busy || totalBalance <= 0} onClick={() => paySalary({ payAll: true })} className="px-4 py-2 text-white text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}>
                  <Users size={13} className="inline mr-1" />
                  Выплатить всем ({money(totalBalance)})
                </button>
              </div>
            </div>
          )}

          <SalaryTable summaries={summaries} loading={loading} expanded={expanded} setExpanded={setExpanded} />
        </>
      )}

      {tab === "bonus" && canManage && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Месяц премии</label>
              <input type="month" value={bonusMonth} onChange={(e) => setBonusMonth(e.target.value)} className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted" />
            </div>
            <button disabled={busy} onClick={() => void calculateBonus()} className="inline-flex items-center gap-2 px-4 py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">
              <Calculator size={14} /> Рассчитать премию
            </button>
            {bonusPaid && (
              <span className="text-[11px] text-success font-semibold">Выплачено {new Date(bonusPaid.paidAt).toLocaleDateString("ru-RU")}</span>
            )}
          </div>

          {bonusDraft && (
            <>
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">KPI за {bonusMonth}</p>
                <div className="flex flex-wrap gap-3 text-[12px]">
                  {Object.entries(bonusDraft.kpiSnapshot ?? {}).map(([k, v]) => (
                    <span key={k} className="px-2.5 py-1 rounded-lg bg-muted font-semibold">
                      {KPI_METRIC_LABELS[k as keyof typeof KPI_METRIC_LABELS] ?? k}: {v}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr className="text-[11px] font-bold text-muted-foreground uppercase">
                      <th className="text-left px-4 py-3">Сотрудник</th>
                      <th className="text-left px-4 py-3">Основание</th>
                      <th className="text-right px-4 py-3">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonusDraft.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border/50">
                        <td className="px-4 py-3 text-[13px] font-bold">{line.staff.name}</td>
                        <td className="px-4 py-3 text-[11px] text-muted-foreground">{line.reason}</td>
                        <td className={`px-4 py-3 text-[13px] font-black text-right ${line.amount < 0 ? "text-destructive" : "text-success"}`}>
                          {line.amount < 0 ? "−" : "+"}{money(Math.abs(line.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                <h3 className="text-[13px] font-bold flex items-center gap-2">
                  <PlusCircle size={15} /> Добавить премию / штраф
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select size="sm" value={manualStaffId} onChange={setManualStaffId} placeholder="Сотрудник" options={hotelStaff.map((s) => ({ value: s.id, label: s.name }))} />
                  <input type="number" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="Сумма" className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted" />
                  <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="За что" className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted md:col-span-2" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-[12px] font-semibold">
                    <input type="checkbox" checked={manualPenalty} onChange={(e) => setManualPenalty(e.target.checked)} />
                    <MinusCircle size={14} className="text-destructive" /> Штраф
                  </label>
                  <button disabled={busy} onClick={() => void addManualBonusLine()} className="px-4 py-2 text-[12px] font-bold rounded-xl border border-primary text-primary hover:bg-accent disabled:opacity-50">
                    Добавить в расчёт
                  </button>
                </div>
              </div>

              <div className="bg-card rounded-xl p-5 border border-border space-y-4">
                <h3 className="text-[13px] font-bold flex items-center gap-2">
                  <Gift size={15} /> Выплатить премию ({money(bonusTotal)})
                </h3>
                <p className="text-[11px] text-muted-foreground">Расчёт можно повторять — фиксируется только после выплаты. Отдельно от зарплаты.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
                  <Select size="sm" value={payMethod} onChange={setPayMethod} options={pmEntries.map(([value, cfg]) => ({ value, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg }))} />
                  <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Комментарий" className="px-3 py-2 text-[12px] rounded-xl border border-border bg-muted" />
                </div>
                <button disabled={busy || bonusTotal <= 0 || bonusDraft.status === "paid"} onClick={() => void payBonus()} className="px-5 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" }}>
                  Выплатить премию
                </button>
              </div>
            </>
          )}

          {!bonusDraft && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
              Нажмите «Рассчитать премию» для формирования черновика по KPI и сменам за месяц.
            </div>
          )}
        </div>
      )}

      {tab === "receipts" && (
        <div className="space-y-3">
          {receipts.length === 0 && (
            <div className="rounded-xl border border-border p-8 text-center text-[13px] text-muted-foreground">
              Нет выплат за выбранный период.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {receipts.map((r) => (
              <ReceiptCard key={r.id} receipt={r} pmConfig={pmConfig} />
            ))}
          </div>
        </div>
      )}

      {!canManage && tab === "salary" && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Gift size={12} /> Вы видите свой расчёт. Выплаты проводит управляющий или владелец.
        </p>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "primary" | "destructive" | "success" }) {
  const color = accent === "destructive" ? "text-destructive" : accent === "success" ? "text-success" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{label}</div>
      <div className={`text-[22px] font-black ${color}`}>{value}</div>
    </div>
  );
}

function SalaryTable({
  summaries,
  loading,
  expanded,
  setExpanded,
}: {
  summaries: Summary[];
  loading: boolean;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted border-b border-border">
          <tr className="text-[11px] font-bold text-muted-foreground uppercase">
            <th className="text-left px-4 py-3">Сотрудник</th>
            <th className="text-center px-2 py-3">Смен</th>
            <th className="text-right px-2 py-3">Начислено</th>
            <th className="text-right px-2 py-3">Выплачено</th>
            <th className="text-right px-2 py-3 hidden sm:table-cell">Штрафы</th>
            <th className="text-right px-4 py-3">Баланс</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Загрузка…</td></tr>}
          {!loading && summaries.map((s) => (
            <Fragment key={s.staffId}>
              <tr className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(expanded === s.staffId ? null : s.staffId)}>
                <td className="px-4 py-3">
                  <div className="text-[13px] font-bold text-foreground">{s.staffName}</div>
                  <div className="text-[10px] text-muted-foreground">{s.role}</div>
                </td>
                <td className="text-center px-2 py-3 text-[13px] font-black text-primary">{s.shiftCount}</td>
                <td className="text-right px-2 py-3 text-[13px] font-bold text-success">{money(s.accrued)}</td>
                <td className="text-right px-2 py-3 text-[13px] font-bold text-muted-foreground">{money(s.paid)}</td>
                <td className="text-right px-2 py-3 text-[13px] font-bold text-destructive hidden sm:table-cell">{s.penalties ? money(s.penalties) : "—"}</td>
                <td className="text-right px-4 py-3 text-[14px] font-black" style={{ color: s.balance > 0 ? "#DC2626" : "#059669" }}>{money(s.balance)}</td>
              </tr>
              {expanded === s.staffId && s.shifts.length > 0 && (
                <tr className="bg-muted/20">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="space-y-1">
                      {s.shifts.map((sh, i) => (
                        <div key={i} className="flex justify-between text-[11px] gap-2">
                          <span className="text-muted-foreground">
                            {fmtMskDateKey(sh.date)} · {SHIFT_ROLE_LABELS[sh.role]}
                            {sh.occupancy != null && ` · загрузка ${sh.occupancy}%`}
                            {sh.hkCount != null && ` · ${sh.hkCount} горн. в день`}
                          </span>
                          <span className="font-bold text-foreground flex-shrink-0">{money(sh.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!loading && summaries.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Нет данных. Заполните график работы.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptCard({
  receipt: r,
  pmConfig,
}: {
  receipt: Receipt;
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
}) {
  const pm = pmConfig[r.paymentMethod];
  const isOut = r.type === "penalty";
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase">{r.typeLabel}</div>
          <div className="text-[15px] font-black text-foreground">{r.staffName}</div>
          <div className="text-[11px] text-muted-foreground">{fmtMskDateKey(r.date)}</div>
        </div>
        <div className={`text-[18px] font-black ${isOut ? "text-destructive" : "text-success"}`}>
          {isOut ? "−" : "+"}{money(r.amount)}
        </div>
      </div>
      {pm && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: pm.bg, color: pm.color }}>
          {pm.label}
        </div>
      )}
      {r.note && <p className="text-[12px] text-foreground/80 border-t border-border pt-2">{r.note}</p>}
      <div className="text-[9px] font-mono text-muted-foreground">№ {r.id.slice(0, 8).toUpperCase()}</div>
    </div>
  );
}
