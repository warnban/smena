"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { Select } from "@/components/ui/select";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { buildManualCategoryOptions } from "@/lib/transaction-categories";
import { mskDateKey } from "@/lib/msk-time";
import type { Hotel, TransactionCategoryDef } from "@/lib/types";

export function CreateTransactionSheet({
  open,
  onClose,
  hotels,
  hotelId,
  pmConfig,
  transactionCategories,
  canManageSettings,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  hotels: Hotel[];
  hotelId: string | "all";
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  transactionCategories: TransactionCategoryDef[];
  canManageSettings: boolean;
  onCreated: () => Promise<void>;
}) {
  const defaultHotel = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;
  const [targetHotelId, setTargetHotelId] = useState(defaultHotel);
  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [operationDate, setOperationDate] = useState(() => mskDateKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTargetHotelId(defaultHotel);
      setDirection("income");
      setCategory("");
      setCategoryLabel("");
      setPaymentMethod("cash");
      setAmount("");
      setGuestName("");
      setNote("");
      setOperationDate(mskDateKey());
      setError("");
    }
  }, [open, defaultHotel]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const categoryOptions = useMemo(
    () =>
      buildManualCategoryOptions(transactionCategories).map((c) => ({
        value: c.code,
        label: c.label,
      })),
    [transactionCategories]
  );

  const pmOptions = useMemo(
    () =>
      Object.entries(pmConfig).map(([value, cfg]) => ({
        value,
        label: cfg.label,
        icon: cfg.icon,
        color: cfg.color,
        bg: cfg.bg,
      })),
    [pmConfig]
  );

  const hotelOptions = useMemo(
    () => hotels.map((h) => ({ value: h.id, label: `${h.name} · ${h.city}` })),
    [hotels]
  );

  async function submit() {
    setError("");
    const amt = Math.round(Number(amount) || 0);
    const catLabel = categoryLabel || categoryOptions.find((o) => o.value === category)?.label || category;
    if (!targetHotelId || !catLabel || amt <= 0) {
      setError("Заполните отель, категорию и сумму");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: targetHotelId,
          direction,
          category: catLabel,
          paymentMethod,
          amount: amt,
          guestName: guestName.trim() || undefined,
          note: note.trim() || undefined,
          operationDate: canManageSettings ? operationDate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать транзакцию");
        return;
      }
      await onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center md:p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tx-title"
        className="relative w-full md:max-w-[540px] max-h-[min(90dvh,640px)] md:max-h-[min(88vh,720px)] flex flex-col bg-card rounded-t-2xl md:rounded-2xl border border-border shadow-2xl animate-slide-up md:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center pt-2 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 py-3 md:px-6 md:py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 id="create-tx-title" className="text-[15px] md:text-[16px] font-bold text-foreground flex items-center gap-2">
            <Plus size={16} className="text-success" /> Новая транзакция
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0 px-5 py-4 md:px-6 md:py-5 space-y-4 md:space-y-5">
          {hotelId === "all" && (
            <Select
              label="Отель"
              value={targetHotelId}
              onChange={setTargetHotelId}
              options={hotelOptions}
            />
          )}

          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-2">Тип операции</label>
            <div className="flex gap-2 md:max-w-[320px]">
              {([
                ["income", "Доход"],
                ["expense", "Расход"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDirection(id)}
                  className="flex-1 py-2.5 text-[12px] font-bold rounded-xl border transition-all"
                  style={{
                    borderColor: direction === id ? (id === "income" ? "#10B981" : "#EF4444") : "hsl(var(--border))",
                    background: direction === id ? (id === "income" ? "#ECFDF5" : "#FEF2F2") : undefined,
                    color: direction === id ? (id === "income" ? "#059669" : "#DC2626") : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <CreatableSelect
            label="Категория"
            value={category}
            onChange={(code, label) => {
              setCategory(code);
              setCategoryLabel(label);
            }}
            options={categoryOptions}
            placeholder="Выберите или создайте категорию"
          />

          <OperationDateField
            enabled={canManageSettings}
            value={operationDate}
            onChange={setOperationDate}
          />

          <div className="md:grid md:grid-cols-2 md:gap-4">
            <Select
              label="Способ оплаты"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={pmOptions}
            />

            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Сумма, ₽</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
                placeholder="0"
              />
            </div>
          </div>

          <div className="md:grid md:grid-cols-2 md:gap-4">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Плательщик / получатель</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
                placeholder="Необязательно"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Примечание</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
                placeholder="Необязательно"
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="flex-shrink-0 border-t border-border px-5 pt-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] md:px-6 md:py-4 md:pb-4 bg-card">
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full md:w-auto md:min-w-[120px] py-2.5 px-4 text-[13px] font-semibold rounded-xl bg-muted text-foreground hover:bg-muted/80"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full md:w-auto md:min-w-[180px] py-2.5 px-4 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
            >
              {busy ? "Создание…" : "Создать транзакцию"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
