"use client";

import { Icon } from "@/components/icon";
import { money, fmtDate } from "@/lib/format";
import { isTransactionCancelled } from "@/lib/finance";
import { TX_CAT_LABELS } from "@/lib/tx-categories";
import { txTypeLabel } from "@/lib/guest-payments";
import type { Transaction } from "@/lib/types";

export function PaymentHistoryList({
  transactions,
  pmConfig,
  emptyText = "Нет платежей",
  className = "",
}: {
  transactions: Transaction[];
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  emptyText?: string;
  className?: string;
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground text-center py-6">{emptyText}</p>
    );
  }

  return (
    <div className={`divide-y divide-border/40 ${className}`}>
      {transactions.map((t) => {
        const cancelled = isTransactionCancelled(t);
        const pmCfg = pmConfig[t.paymentMethod] ?? {
          label: t.paymentMethod,
          color: "#64748B",
          icon: "Banknote",
        };
        const isOut = t.type === "expense" || t.type === "encashment" || t.type === "refund";
        const amountColor = isOut ? "text-destructive" : "text-success";
        const typeLabel = txTypeLabel(t);
        const catLabel = TX_CAT_LABELS[t.category] ?? t.category;

        return (
          <div key={t.id} className={`px-4 py-3 hover:bg-muted/40 transition-colors ${cancelled ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cancelled ? "bg-muted text-muted-foreground" : isOut ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    }`}
                  >
                    {typeLabel}
                  </span>
                  {cancelled && (
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Отменена</span>
                  )}
                  <span className="text-[10px] font-semibold text-muted-foreground">{catLabel}</span>
                  {t.roomNumber && (
                    <span className="text-[10px] text-muted-foreground">№{t.roomNumber}</span>
                  )}
                </div>
                {t.note && (
                  <p className="text-[12px] text-foreground/90 leading-snug">{t.note}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">
                    {fmtDate(t.date, true)}{" "}
                    {t.date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name={pmCfg.icon} size={11} style={{ color: pmCfg.color }} />
                    <span className="font-semibold" style={{ color: pmCfg.color }}>
                      {pmCfg.label}
                    </span>
                  </span>
                </div>
              </div>
              <div className={`text-[14px] font-black tabular-nums shrink-0 ${cancelled ? "line-through text-muted-foreground" : amountColor}`}>
                {isOut ? "−" : "+"}
                {money(Math.abs(t.amount))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
