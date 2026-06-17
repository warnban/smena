"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Percent } from "lucide-react";
import type { HotelDiscountRule, PaymentMethodDef } from "@/lib/types";
import { formatRuleDiscount } from "@/lib/hotel-discount-rules";
import { Select } from "@/components/ui/select";

type RuleDraft = Omit<HotelDiscountRule, "id" | "hotelId"> & { id?: string };

const emptyRule = (): RuleDraft => ({
  name: "",
  minNights: 10,
  discountPercent: 0,
  discountPerNight: 0,
  paymentMethod: null,
  active: true,
  sortOrder: 0,
});

export function HotelDiscountRulesEditor({
  hotelId,
  canEdit,
  paymentMethods,
  onSaved,
}: {
  hotelId: string;
  canEdit: boolean;
  paymentMethods: PaymentMethodDef[];
  onSaved: () => Promise<void>;
}) {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/hotels/${hotelId}/discount-rules`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRules((data.rules ?? []).map((r: HotelDiscountRule) => ({ ...r })));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  function updateRule(idx: number, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    setMsg("");
    setErr("");
    const res = await fetch(`/api/hotels/${hotelId}/discount-rules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "Ошибка сохранения");
      return;
    }
    setRules((data.rules ?? []).map((r: HotelDiscountRule) => ({ ...r })));
    setMsg("Сохранено");
    await onSaved();
  }

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border">
      <div className="px-5 py-3.5 flex items-center gap-2.5 bg-muted border-b border-border">
        <Percent size={14} className="text-muted-foreground" />
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Скидки за предоплату</h3>
          <p className="text-[11px] text-muted-foreground">Условия применяются к каждой отдельной оплате проживания</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {loading ? (
          <p className="text-[12px] text-muted-foreground">Загрузка…</p>
        ) : rules.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Правила не настроены — скидки вводятся вручную при оплате.</p>
        ) : (
          rules.map((rule, idx) => (
            <div key={rule.id ?? idx} className="rounded-xl border border-border p-4 space-y-3 bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Название</label>
                    <input
                      disabled={!canEdit}
                      value={rule.name}
                      onChange={(e) => updateRule(idx, { name: e.target.value })}
                      placeholder="Напр. Наличные 10+ ночей"
                      className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-card outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Мин. ночей в оплате</label>
                    <input
                      type="number"
                      min={1}
                      disabled={!canEdit}
                      value={rule.minNights}
                      onChange={(e) => updateRule(idx, { minNights: Number(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-card outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Скидка, %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canEdit}
                      value={rule.discountPercent}
                      onChange={(e) => updateRule(idx, { discountPercent: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-card outline-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Скидка, ₽/сут.</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={rule.discountPerNight}
                      onChange={(e) => updateRule(idx, { discountPerNight: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-card outline-none disabled:opacity-60"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Способ оплаты</label>
                    <Select
                      size="sm"
                      disabled={!canEdit}
                      value={rule.paymentMethod ?? ""}
                      onChange={(v) => updateRule(idx, { paymentMethod: v || null })}
                      placeholder="Любой"
                      options={[
                        { value: "", label: "Любой" },
                        ...paymentMethods.filter((p) => p.active).map((p) => ({ value: p.code, label: p.label })),
                      ]}
                    />
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatRuleDiscount(rule)} · от {rule.minNights} ноч.
                {rule.paymentMethod ? ` · ${paymentMethods.find((p) => p.code === rule.paymentMethod)?.label ?? rule.paymentMethod}` : ""}
              </p>
            </div>
          ))
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, emptyRule()])}
            className="flex items-center gap-2 text-[12px] font-bold text-primary hover:underline"
          >
            <Plus size={14} /> Добавить правило
          </button>
        )}

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <button
              disabled={busy}
              onClick={save}
              className="px-5 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              {busy ? "Сохранение…" : "Сохранить скидки"}
            </button>
            {msg && <span className="text-[12px] text-success font-semibold">{msg}</span>}
            {err && <span className="text-[12px] text-destructive font-semibold">{err}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
