"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { Select } from "@/components/ui/select";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { money } from "@/lib/format";
import { categoryLabel } from "@/lib/transaction-categories";
import { mskDateKey } from "@/lib/msk-time";
import {
  isTransactionCancelled,
  txAmountColor,
  txIsOutflow,
  txPartyLabel,
  txTypeLabel,
} from "@/lib/transaction-display";
import { fmtMskDateTime } from "@/lib/msk-time";
import type { Transaction, TransactionCategoryDef } from "@/lib/types";

export function TransactionDetailSheet({
  tx,
  pmConfig,
  hotelName,
  transactionCategories,
  canManage,
  cancelBusy,
  onClose,
  onCancel,
  onUpdated,
}: {
  tx: Transaction | null;
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  hotelName?: string;
  transactionCategories: TransactionCategoryDef[];
  canManage: boolean;
  cancelBusy: boolean;
  onClose: () => void;
  onCancel: (id: string) => Promise<void>;
  onUpdated: () => Promise<void>;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editable, setEditable] = useState(false);
  const [editBlockReason, setEditBlockReason] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [guestName, setGuestName] = useState("");
  const [operationDate, setOperationDate] = useState(() => mskDateKey());

  useEffect(() => {
    if (!tx) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [tx]);

  useEffect(() => {
    if (!tx) {
      setConfirmCancel(false);
      setEditing(false);
      return;
    }
    setConfirmCancel(false);
    setEditing(false);
    setEditError("");
    setDirection(txIsOutflow(tx) ? "expense" : "income");
    setAmount(String(tx.amount));
    setPaymentMethod(tx.paymentMethod);
    setGuestName(tx.guestName ?? "");
    setOperationDate(mskDateKey(tx.date));

    if (!canManage) {
      setEditable(false);
      setEditBlockReason(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/transactions/${tx.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEditable(Boolean(data.editable));
        setEditBlockReason(data.editBlockReason ?? null);
        if (data.direction) setDirection(data.direction);
      })
      .catch(() => {
        if (!cancelled) {
          setEditable(false);
          setEditBlockReason("Не удалось проверить возможность редактирования");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tx, canManage]);

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

  if (!tx) return null;

  const cancelled = isTransactionCancelled(tx);
  const pmCfg = pmConfig[tx.paymentMethod] ?? { label: tx.paymentMethod, color: "#64748B", bg: "#F1F5F9", icon: "Banknote" };
  const isOut = txIsOutflow(tx);
  const amountColor = txAmountColor(tx, cancelled);
  const catLabel = categoryLabel(tx.category, transactionCategories);

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Дата и время", value: fmtMskDateTime(tx.date) },
    { label: "Тип", value: txTypeLabel(tx.type) },
    { label: "Категория", value: catLabel },
  ];

  if (!editing) {
    rows.push({ label: "Плательщик / получатель", value: txPartyLabel(tx) });
  }
  if (tx.roomNumber) rows.push({ label: "Номер", value: `№${tx.roomNumber}` });
  if (hotelName) rows.push({ label: "Отель", value: hotelName });
  if (tx.paymentNights) rows.push({ label: "Ночей в оплате", value: String(tx.paymentNights) });
  if (tx.discountPercentApplied || tx.discountPerNightApplied) {
    const parts: string[] = [];
    if (tx.discountPercentApplied) parts.push(`${tx.discountPercentApplied}%`);
    if (tx.discountPerNightApplied) parts.push(`${tx.discountPerNightApplied} ₽/сут.`);
    rows.push({ label: "Скидка", value: parts.join(" + ") });
  }
  if (tx.note?.trim()) rows.push({ label: "Примечание", value: tx.note.trim() });

  async function saveEdit() {
    setEditError("");
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) {
      setEditError("Укажите сумму");
      return;
    }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/transactions/${tx!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          amount: amt,
          paymentMethod,
          guestName: guestName.trim(),
          operationDate: canManage ? operationDate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Не удалось сохранить");
        return;
      }
      setEditing(false);
      await onUpdated();
      onClose();
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-detail-title"
        className="relative w-full md:max-w-[540px] max-h-[min(85dvh,620px)] md:max-h-[min(88vh,680px)] flex flex-col bg-card rounded-t-2xl md:rounded-2xl border border-border shadow-2xl animate-slide-up md:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center pt-2 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex-shrink-0 border-b border-border px-5 py-3 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between gap-3 mb-4">
            <h2 id="tx-detail-title" className="text-[16px] font-bold text-foreground">
              Транзакция
            </h2>
            <div className="flex items-center gap-1">
              {canManage && editable && !cancelled && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary hover:bg-accent"
                >
                  <Pencil size={14} />
                  Редактировать
                </button>
              )}
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 md:gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    cancelled
                      ? "bg-muted text-muted-foreground"
                      : isOut
                        ? "bg-destructive/10 text-destructive"
                        : tx.type === "service"
                          ? "bg-accent text-primary"
                          : "bg-success/10 text-success"
                  }`}
                >
                  {txTypeLabel(tx.type)}
                </span>
                {cancelled && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Отменена</span>
                )}
              </div>
              <div
                className={`text-[28px] md:text-[32px] font-black leading-tight ${cancelled ? "line-through text-muted-foreground" : ""}`}
                style={amountColor ? { color: amountColor } : undefined}
              >
                {isOut ? "−" : "+"} {money(editing ? Math.round(Number(amount) || 0) : tx.amount)}
              </div>
            </div>

            {!editing && (
              <div className="hidden md:flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-border bg-muted/40 flex-shrink-0 min-w-[168px]">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: pmCfg.bg }}>
                  <Icon name={pmCfg.icon} size={16} style={{ color: pmCfg.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Способ оплаты</div>
                  <div className="text-[13px] font-bold truncate" style={{ color: pmCfg.color }}>{pmCfg.label}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1 flex-shrink-0 md:hidden">
              {canManage && editable && !cancelled && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-lg text-primary hover:bg-accent"
                  aria-label="Редактировать"
                >
                  <Pencil size={16} />
                </button>
              )}
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0 px-5 py-4 md:px-6 md:py-5 space-y-4">
          {editing ? (
            <div className="space-y-4 md:space-y-5">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-2">Доход / расход</label>
                <div className="flex gap-2 md:max-w-[320px]">
                  {([
                    ["income", "Доход"],
                    ["expense", "Расход"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDirection(id)}
                      disabled={tx.type === "service" || tx.type === "encashment"}
                      className="flex-1 py-2.5 text-[12px] font-bold rounded-xl border transition-all disabled:opacity-50"
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

              <div className="md:grid md:grid-cols-2 md:gap-4">
                <Select label="Способ оплаты" value={paymentMethod} onChange={setPaymentMethod} options={pmOptions} />

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Сумма, ₽</label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="md:max-w-[360px]">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Плательщик / получатель</label>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {canManage && (
                <OperationDateField
                  enabled
                  value={operationDate}
                  onChange={setOperationDate}
                />
              )}

              {editError && <p className="text-[12px] text-destructive font-semibold">{editError}</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-border bg-muted/40 md:hidden">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: pmCfg.bg }}>
                  <Icon name={pmCfg.icon} size={16} style={{ color: pmCfg.color }} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Способ оплаты</div>
                  <div className="text-[13px] font-bold" style={{ color: pmCfg.color }}>{pmCfg.label}</div>
                </div>
              </div>

              <dl className="space-y-3 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-4 md:space-y-0">
                {rows.map(({ label, value }) => (
                  <div key={label} className={label === "Примечание" ? "md:col-span-2" : undefined}>
                    <dt className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">{label}</dt>
                    <dd className="text-[13px] text-foreground font-medium break-words">{value}</dd>
                  </div>
                ))}
              </dl>

              {canManage && !cancelled && !editable && editBlockReason && (
                <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/60 border border-border px-3 py-2 md:col-span-2">
                  {editBlockReason}
                </p>
              )}
            </>
          )}
        </div>

        <div
          className="flex-shrink-0 border-t border-border px-5 pt-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] md:px-6 md:py-4 md:pb-4 space-y-2 bg-card md:space-y-0"
        >
          {editing ? (
            <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-full md:w-auto md:min-w-[120px] py-2.5 px-4 text-[13px] font-semibold rounded-xl bg-muted text-foreground"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={editBusy}
                onClick={() => void saveEdit()}
                className="w-full md:w-auto md:min-w-[140px] py-2.5 px-4 text-[13px] font-bold rounded-xl text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
              >
                {editBusy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={onClose}
                className="w-full md:w-auto md:min-w-[120px] py-2.5 px-4 text-[13px] font-bold rounded-xl bg-muted text-foreground hover:bg-muted/80"
              >
                Закрыть
              </button>

              {canManage && !cancelled && (
                confirmCancel ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2 md:flex md:flex-1 md:items-center md:justify-between md:gap-4 md:ml-4 md:p-4">
                    <p className="text-[12px] font-semibold text-center md:text-left text-foreground">
                      Отменить транзакцию? Она останется в списке, но не будет учитываться в отчётах.
                    </p>
                    <div className="flex gap-2 md:flex-shrink-0">
                      <button type="button" onClick={() => setConfirmCancel(false)} className="flex-1 md:flex-none md:min-w-[88px] py-2.5 px-4 text-[12px] font-semibold rounded-xl bg-muted text-foreground">
                        Нет
                      </button>
                      <button
                        type="button"
                        disabled={cancelBusy}
                        onClick={() => void onCancel(tx.id)}
                        className="flex-1 md:flex-none md:min-w-[108px] py-2.5 px-4 text-[12px] font-bold rounded-xl text-white bg-destructive hover:opacity-90 disabled:opacity-50"
                      >
                        {cancelBusy ? "…" : "Отменить"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="w-full md:w-auto md:min-w-[180px] py-2.5 px-4 text-[13px] font-bold rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/5"
                  >
                    Отменить транзакцию
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
