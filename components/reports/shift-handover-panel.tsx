"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate } from "@/lib/format";
import { fmtMskDateTime, mskDateKey } from "@/lib/msk-time";
import { buildShiftHandover } from "@/lib/shift-handover";

export function ShiftHandoverPanel({
  hotelId,
  hotelName,
  pmConfig,
}: {
  hotelId: string;
  hotelName: string;
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
}) {
  const { transactions, bookings, rooms, beds, paymentMethods } = useApp();

  const data = useMemo(
    () => buildShiftHandover(transactions, bookings, rooms, paymentMethods, hotelId, mskDateKey(), beds),
    [transactions, bookings, rooms, beds, paymentMethods, hotelId]
  );

  const nowLabel = fmtMskDateTime(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-foreground">Пересменка</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {hotelName} · на {nowLabel} (МСК)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <RefreshCw size={12} />
          Обновляется при загрузке данных
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 border-2 border-primary/30">
        <div className="text-[11px] font-bold text-muted-foreground uppercase mb-1">Наличные в кассе сейчас</div>
        <div className="text-[32px] font-black text-primary">{money(data.cashBalance)}</div>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border">
        <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-3">
          Выручка за сегодня ({fmtDate(new Date(data.dateKey), true)})
        </h4>
        <table className="w-full table-fixed text-[11px] sm:text-[12px]">
          <thead>
            <tr className="text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase border-b border-border">
              <th className="text-left py-1.5 sm:py-2 pr-1 sm:pr-4 w-[44%]">Способ</th>
              <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[28%]">Гости</th>
              <th className="text-right py-1.5 sm:py-2 pl-0.5 sm:pl-2 w-[28%]">Всего</th>
            </tr>
          </thead>
          <tbody>
            {data.byPayment.map((row) => {
              if (row.accommodation === 0 && row.total === 0) return null;
              const cfg = pmConfig[row.code] ?? { label: row.code, color: "#64748B", icon: "Banknote" };
              return (
                <tr key={row.code} className="border-b border-border/40">
                  <td className="py-1.5 sm:py-2.5 pr-1 sm:pr-4">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                      <Icon name={cfg.icon} size={12} style={{ color: cfg.color }} />
                      <span className="font-semibold truncate" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  </td>
                  <td className="text-right py-1.5 sm:py-2.5 px-0.5 sm:px-2 font-bold text-success tabular-nums">{money(row.accommodation)}</td>
                  <td className="text-right py-1.5 sm:py-2.5 pl-0.5 sm:pl-2 font-black tabular-nums">{money(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t border-border">
              <td className="py-1.5 sm:py-2.5">Итого</td>
              <td className="text-right py-1.5 sm:py-2.5 text-success tabular-nums">{money(data.accommodationTotal)}</td>
              <td className="text-right py-1.5 sm:py-2.5 tabular-nums">{money(data.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border">
        <h4 className="text-[12px] font-bold text-muted-foreground uppercase mb-3">
          Ожидаются оплаты · {data.unpaidGuests.length} гостей
        </h4>
        {data.unpaidGuests.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4 text-center">Все проживающие гости оплатили проживание</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto custom-scrollbar space-y-2">
            {data.unpaidGuests.map((g) => (
              <div
                key={g.bookingId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-foreground truncate">{g.guestName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    №{g.roomNumber} · оплачено {money(g.paid)} из {money(g.amount)}
                    {g.debtNights > 0 ? ` · ${g.debtNights} н.` : ""}
                  </div>
                </div>
                <div className="text-[14px] font-black text-destructive shrink-0">{money(g.debt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
