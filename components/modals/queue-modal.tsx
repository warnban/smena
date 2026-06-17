"use client";

import { useMemo, useState } from "react";
import { X, UserCheck, LogOut, CalendarClock, CreditCard } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate, inits } from "@/lib/format";
import { filterPaymentDueBookings, paymentDueInfo } from "@/lib/booking-payment-due";
import { mskDateKey } from "@/lib/msk-time";
import type { Booking } from "@/lib/types";
import { CheckInModal } from "@/components/modals/check-in-modal";
import { BookingModal } from "@/components/modals/booking-modal";

export function QueueModal({
  mode,
  onClose,
}: {
  mode: "arrival" | "departure" | "payment";
  onClose: () => void;
}) {
  const { bookings, rooms, hotelId, transactions } = useApp();
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [selBooking, setSelBooking] = useState<Booking | null>(null);
  const [stayChangeMode, setStayChangeMode] = useState(false);

  const TODAY = useMemo(() => new Date(), []);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const scoped = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );

  const scopedTxns = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );

  const list = useMemo(() => {
    if (mode === "arrival") {
      return scoped.filter(
        (b) => sameDay(b.checkIn, TODAY) && (b.status === "new" || b.status === "confirmed")
      );
    }
    if (mode === "departure") {
      return scoped.filter(
        (b) => sameDay(b.checkOut, TODAY) && b.status === "checkedin"
      );
    }
    return filterPaymentDueBookings(scoped, mskDateKey(), scopedTxns);
  }, [scoped, mode, scopedTxns]);

  const title =
    mode === "arrival"
      ? "Ожидаемые заезды"
      : mode === "departure"
        ? "Ожидаемые выезды"
        : "Ожидаются оплаты";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div
          className="bg-card rounded-2xl shadow-2xl flex flex-col w-full max-w-[520px] border border-border max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 flex items-center justify-between border-b border-border">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
              <p className="text-[12px] text-muted-foreground">{fmtDate(TODAY)} · {list.length} гостей</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {list.map((b) => {
              const room = rooms.find((r) => r.id === b.roomId);
              const due = mode === "payment" ? paymentDueInfo(b, mskDateKey(), scopedTxns) : null;
              const debt = due?.debt ?? b.amount - b.paid;
              const debtNights = due?.debtNights ?? 0;
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                    {inits(b.guestName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{b.guestName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      №{room?.number} · {fmtDate(b.checkIn, true)} → {fmtDate(b.checkOut, true)}
                      {debt > 0 ? ` · долг ${money(debt)}${debtNights > 0 ? ` (${debtNights} н.)` : ""}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {mode === "arrival" ? (
                      <button
                        onClick={() => setCheckInBooking(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-white text-[11px] font-bold rounded-lg hover:opacity-90"
                        style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
                      >
                        <UserCheck size={12} /> Заселить
                      </button>
                    ) : mode === "departure" ? (
                      <>
                        <button
                          onClick={() => { setStayChangeMode(false); setSelBooking(b); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-white text-[11px] font-bold rounded-lg hover:opacity-90"
                          style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
                        >
                          <LogOut size={12} /> Выписать
                        </button>
                        <button
                          onClick={() => { setStayChangeMode(true); setSelBooking(b); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-border text-primary hover:bg-accent"
                        >
                          <CalendarClock size={12} /> Срок проживания
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setSelBooking(b); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-white text-[11px] font-bold rounded-lg hover:opacity-90"
                        style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}
                      >
                        <CreditCard size={12} /> Оплата
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {list.length === 0 && (
              <p className="text-center text-[13px] text-muted-foreground py-8">
                {mode === "payment" ? "Нет неоплаченных гостей" : "Нет записей на сегодня"}
              </p>
            )}
          </div>
        </div>
      </div>
      {checkInBooking && (
        <CheckInModal booking={checkInBooking} onClose={() => setCheckInBooking(null)} onDone={onClose} />
      )}
      {selBooking && (
        <BookingModal
          booking={selBooking}
          initialTab={mode === "payment" ? "payment" : "details"}
          onClose={() => setSelBooking(null)}
          openStayChange={stayChangeMode}
        />
      )}
    </>
  );
}
