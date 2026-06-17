"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Select } from "@/components/ui/select";
import { KPI_METRIC_LABELS, KPI_METRIC_UNITS } from "@/lib/kpi-bonus";
import type { Hotel } from "@/lib/types";

type Tier = { minOccupancy: number; maxOccupancy: number; dayRate: number; nightRate: number };
type KpiRule = {
  label: string;
  metric: keyof typeof KPI_METRIC_LABELS;
  threshold: number;
  bonusAmount: number;
  active: boolean;
};

const METRIC_OPTIONS = Object.entries(KPI_METRIC_LABELS).map(([value, label]) => ({ value, label }));
const inp = "w-full min-w-0 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-card outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

export function SalarySettingsEditor({ hotels, canEdit }: { hotels: Hotel[]; canEdit: boolean }) {
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? "");
  const [hkSoloRate, setHkSoloRate] = useState(5000);
  const [hkDuoRate, setHkDuoRate] = useState(3500);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [rules, setRules] = useState<KpiRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!hotelId) return;
    const res = await fetch(`/api/hotels/${hotelId}/salary-settings`);
    if (!res.ok) return;
    const data = await res.json();
    setHkSoloRate(data.hkSoloRate ?? 5000);
    setHkDuoRate(data.hkDuoRate ?? 3500);
    setTiers(data.tiers ?? []);
    setRules(
      (data.rules ?? []).map((r: KpiRule & { metric: string }) => ({
        label: r.label,
        metric: r.metric as KpiRule["metric"],
        threshold: r.threshold,
        bonusAmount: r.bonusAmount,
        active: r.active,
      }))
    );
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!hotelId || !canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/hotels/${hotelId}/salary-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hkSoloRate, hkDuoRate, tiers, rules }),
      });
      if (!res.ok) {
        setMsg("Ошибка");
        return;
      }
      setMsg("Сохранено");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!hotels.length) {
    return <p className="text-[13px] text-muted-foreground">Сначала добавьте отель.</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Отель</label>
          <Select value={hotelId} onChange={setHotelId} options={hotels.map((h) => ({ value: h.id, label: `${h.name} · ${h.city}` }))} />
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-white text-[12px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50 w-full sm:w-auto"
            style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
          >
            <Save size={14} /> {busy ? "…" : "Сохранить"}
          </button>
        )}
        {msg && <span className="text-[12px] font-semibold text-success sm:pb-2">{msg}</span>}
      </div>

      {/* Админы по загрузке — компактная таблица */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted/40">
          <h3 className="text-[13px] font-bold">Админы: ставка от загрузки в день смены</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12px]">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
                <th className="text-left px-2 py-2">Загрузка %</th>
                <th className="text-right px-2 py-2">День, ₽</th>
                <th className="text-right px-2 py-2">Ночь, ₽</th>
                {canEdit && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={100} disabled={!canEdit} value={t.minOccupancy} onChange={(e) => setTiers((p) => p.map((x, j) => j === i ? { ...x, minOccupancy: +e.target.value || 0 } : x))} className={`${inp} w-14`} />
                      <span className="text-muted-foreground">—</span>
                      <input type="number" min={0} max={100} disabled={!canEdit} value={t.maxOccupancy} onChange={(e) => setTiers((p) => p.map((x, j) => j === i ? { ...x, maxOccupancy: +e.target.value || 0 } : x))} className={`${inp} w-14`} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} disabled={!canEdit} value={t.dayRate} onChange={(e) => setTiers((p) => p.map((x, j) => j === i ? { ...x, dayRate: +e.target.value || 0 } : x))} className={`${inp} text-right`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} disabled={!canEdit} value={t.nightRate} onChange={(e) => setTiers((p) => p.map((x, j) => j === i ? { ...x, nightRate: +e.target.value || 0 } : x))} className={`${inp} text-right`} />
                  </td>
                  {canEdit && (
                    <td className="px-1 py-1.5">
                      <button type="button" onClick={() => setTiers((p) => p.filter((_, j) => j !== i))} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={canEdit ? 4 : 3} className="px-3 py-4 text-center text-muted-foreground">Нет диапазонов — стандарт 2 500 / 3 000 ₽</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="px-3 py-2 border-t border-border">
            <button type="button" onClick={() => setTiers((p) => [...p, { minOccupancy: 0, maxOccupancy: 100, dayRate: 2500, nightRate: 3000 }])} className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1">
              <Plus size={12} /> Диапазон
            </button>
          </div>
        )}
      </div>

      {/* Горничные — фикс по числу в смене */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
        <h3 className="text-[13px] font-bold mb-1">Горничные: фикс за смену</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Не зависит от загрузки. Считается, сколько горничных в графике на этот день.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground block mb-1">1 горничная в день, ₽</label>
            <input type="number" min={0} disabled={!canEdit} value={hkSoloRate} onChange={(e) => setHkSoloRate(+e.target.value || 0)} className={inp} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground block mb-1">2 и более в день, ₽ каждой</label>
            <input type="number" min={0} disabled={!canEdit} value={hkDuoRate} onChange={(e) => setHkDuoRate(+e.target.value || 0)} className={inp} />
          </div>
        </div>
      </div>

      {/* KPI — компактная таблица */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted/40">
          <h3 className="text-[13px] font-bold">Премии KPI за месяц</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Каждый сотрудник со сменами получает указанную сумму лично (не делится).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
                <th className="text-left px-2 py-2">Название</th>
                <th className="text-left px-2 py-2">KPI</th>
                <th className="text-right px-2 py-2">Порог</th>
                <th className="text-right px-2 py-2">₽/чел</th>
                <th className="text-center px-1 py-2">Вкл</th>
                {canEdit && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 ${r.active ? "" : "opacity-50"}`}>
                  <td className="px-2 py-1.5">
                    <input disabled={!canEdit} value={r.label} onChange={(e) => setRules((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Название" className={inp} />
                  </td>
                  <td className="px-2 py-1.5 min-w-[140px]">
                    <Select size="sm" value={r.metric} onChange={(v) => setRules((p) => p.map((x, j) => j === i ? { ...x, metric: v as KpiRule["metric"] } : x))} options={METRIC_OPTIONS} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <input type="number" disabled={!canEdit} value={r.threshold} onChange={(e) => setRules((p) => p.map((x, j) => j === i ? { ...x, threshold: +e.target.value || 0 } : x))} className={`${inp} w-20 text-right`} />
                      <span className="text-[10px] text-muted-foreground w-4">{KPI_METRIC_UNITS[r.metric]}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} disabled={!canEdit} value={r.bonusAmount} onChange={(e) => setRules((p) => p.map((x, j) => j === i ? { ...x, bonusAmount: +e.target.value || 0 } : x))} className={`${inp} text-right`} />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <input type="checkbox" disabled={!canEdit} checked={r.active} onChange={(e) => setRules((p) => p.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} />
                  </td>
                  {canEdit && (
                    <td className="px-1 py-1.5">
                      <button type="button" onClick={() => setRules((p) => p.filter((_, j) => j !== i))} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={canEdit ? 6 : 5} className="px-3 py-4 text-center text-muted-foreground">Нет правил KPI</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="px-3 py-2 border-t border-border">
            <button type="button" onClick={() => setRules((p) => [...p, { label: "", metric: "occupancy", threshold: 70, bonusAmount: 5000, active: true }])} className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1">
              <Plus size={12} /> Правило KPI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
