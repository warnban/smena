"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, UserCheck, LogOut, ShoppingBag, ArrowRightLeft, RotateCcw } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { NewBookingModal } from "@/components/modals/new-booking-modal";
import { CheckInModal } from "@/components/modals/check-in-modal";
import { BookingModal } from "@/components/modals/booking-modal";
import { QueueModal } from "@/components/modals/queue-modal";
import { SaleModal } from "@/components/modals/sale-modal";
import { RefundModal } from "@/components/modals/refund-modal";
import { RelocateModal } from "@/components/modals/relocate-modal";
import {
  buildStayReminders,
  filterPaymentDueBookings,
  paymentDueInfo,
  paymentSoonInfo,
  type StayReminderKind,
} from "@/lib/booking-payment-due";
import { mskDayAfter, mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate, inits } from "@/lib/format";
import { calcKpis } from "@/lib/reporting";
import { pmCodes } from "@/lib/payment-methods";
import type { Booking } from "@/lib/types";

const STAY_REMINDER_LABEL: Record<StayReminderKind, string> = {
  paymentSoon: "скоро оплата",
  checkout: "выезд",
};

function GuestRow({
  booking,
  roomNumber,
  subline,
  btnLabel,
  btnColor,
  onAction,
}: {
  booking: Booking;
  roomNumber?: string;
  subline?: string;
  btnLabel: string;
  btnColor: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border/50 last:border-0">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ background: "#EFF6FF", color: "#2563EB" }}
      >
        {inits(booking.guestName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-foreground truncate">{booking.guestName}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {roomNumber ? `№${roomNumber}` : ""}
          {subline ? `${roomNumber ? " · " : ""}${subline}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="px-2 py-1 text-white text-[10px] font-bold rounded-lg flex-shrink-0 hover:opacity-90"
        style={{ background: btnColor }}
      >
        {btnLabel}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { bookings, rooms, hotels, hotelId, transactions, paymentMethods, loading } = useApp();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [selBooking, setSelBooking] = useState<Booking | null>(null);
  const [bookingTab, setBookingTab] = useState<"details" | "payment" | "history">("details");
  const [queueMode, setQueueMode] = useState<"arrival" | "departure" | "payment" | null>(null);
  const [showSale, setShowSale] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showRelocate, setShowRelocate] = useState(false);

  const TODAY = useMemo(() => new Date(), []);
  const tomorrowKey = useMemo(() => mskDayAfter(mskDateKey(TODAY)), [TODAY]);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );
  const scopedRooms = useMemo(
    () => (hotelId === "all" ? rooms : rooms.filter((r) => r.hotelId === hotelId)),
    [rooms, hotelId]
  );
  const scopedTxns = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );

  const codes = useMemo(() => pmCodes(paymentMethods), [paymentMethods]);

  const kpis = useMemo(
    () => calcKpis(scopedTxns, scopedBookings, scopedRooms, codes),
    [scopedTxns, scopedBookings, scopedRooms, codes.join(",")]
  );

  const arrivals = scopedBookings.filter(
    (b) => sameDay(b.checkIn, TODAY) && (b.status === "new" || b.status === "confirmed")
  );
  const departures = scopedBookings.filter(
    (b) => sameDay(b.checkOut, TODAY) && b.status === "checkedin"
  );
  const payDue = useMemo(
    () => filterPaymentDueBookings(scopedBookings, mskDateKey(), scopedTxns),
    [scopedBookings, scopedTxns]
  );
  const payDueTotal = useMemo(
    () => payDue.reduce((s, b) => s + paymentDueInfo(b, mskDateKey(), scopedTxns).debt, 0),
    [payDue, scopedTxns]
  );
  const stayReminders = useMemo(
    () => buildStayReminders(scopedBookings, mskDateKey(), scopedTxns),
    [scopedBookings, scopedTxns]
  );
  const occupied = scopedRooms.filter((r) => r.status === "occupied" || r.status === "checkin").length;

  const occChartData = useMemo(() => {
    const total = Math.max(1, scopedRooms.length);
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    return days.map((dname, i) => {
      const day = new Date(TODAY);
      day.setDate(TODAY.getDate() - (6 - i));
      const occ = scopedBookings.filter(
        (b) => b.checkIn <= day && b.checkOut > day && b.status !== "cancelled"
      ).length;
      return { d: dname, v: Math.min(100, Math.round((occ / total) * 100)) };
    });
  }, [scopedBookings, scopedRooms, TODAY]);

  if (loading) {
    return (
      <>
        <TopBar title="Dashboard" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
        {showNewBooking && <NewBookingModal onClose={() => setShowNewBooking(false)} />}
        {checkInBooking && <CheckInModal booking={checkInBooking} onClose={() => setCheckInBooking(null)} />}
        {selBooking && <BookingModal booking={selBooking} initialTab={bookingTab} onClose={() => setSelBooking(null)} />}
        {queueMode && <QueueModal mode={queueMode} onClose={() => setQueueMode(null)} />}
        {showSale && <SaleModal onClose={() => setShowSale(false)} />}
        {showRefund && <RefundModal onClose={() => setShowRefund(false)} />}
        {showRelocate && <RelocateModal onClose={() => setShowRelocate(false)} />}
      </>
    );
  }

  return (
    <>
      <TopBar title={hotelId === "all" ? "Dashboard · Все отели" : "Dashboard"} subtitle={fmtDate(TODAY)} />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {hotelId === "all" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {hotels.map((h) => {
              const hR = rooms.filter((r) => r.hotelId === h.id);
              const hOcc = hR.filter((r) => r.status === "occupied" || r.status === "checkin").length;
              const cap = Math.max(1, hR.length);
              return (
                <div key={h.id} className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-black" style={{ background: "#3B82F6" }}>
                      {h.stars}★
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-foreground">{h.name}</div>
                      <div className="text-[11px] text-muted-foreground">{h.city}</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <div>
                      <div className="font-black text-[18px] text-primary">{Math.round((hOcc / cap) * 100)}%</div>
                      <div className="text-muted-foreground">загрузка</div>
                    </div>
                    <div>
                      <div className="font-black text-[18px] text-foreground">{hOcc}/{hR.length}</div>
                      <div className="text-muted-foreground">занято</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard label="Загрузка" value={`${Math.round((occupied / Math.max(1, scopedRooms.length)) * 100)}%`} sub={`${occupied}/${scopedRooms.length} ном.`} trend="+5%" trendDir="up" accent="#3B82F6" spark={[62, 68, 71, 79, 77]} />
          <KpiCard label="Заезды сегодня" value={String(arrivals.length)} sub="гостей" trend="+2" trendDir="up" accent="#F59E0B" spark={[1, 3, 2, 4, 3]} />
          <KpiCard label="Выезды сегодня" value={String(departures.length)} sub="гостей" accent="#6366F1" spark={[2, 1, 3, 2, 2]} />
          <button
            type="button"
            onClick={() => setQueueMode("payment")}
            className="text-left"
          >
            <KpiCard label="К оплате" value={String(payDue.length)} sub={money(payDueTotal)} accent="#EF4444" spark={[0, 2, 1, 3, payDue.length]} />
          </button>
          <KpiCard
            label="RevPAR"
            value={money(kpis.revpar)}
            sub={`ADR: ${money(kpis.adr)} · месяц`}
            trend={kpis.revparTrend ? `${kpis.revparTrend > 0 ? "+" : ""}${kpis.revparTrend}%` : undefined}
            trendDir={kpis.revparTrend >= 0 ? "up" : "down"}
            accent="#8B5CF6"
            spark={kpis.revparSpark}
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => setShowNewBooking(true)} className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}><Plus size={14} /> Новое бронирование</button>
          <button
            onClick={() => setQueueMode("arrival")}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
          >
            <UserCheck size={14} /> Заселить {arrivals.length > 0 && `(${arrivals.length})`}
          </button>
          <button
            onClick={() => setQueueMode("departure")}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
          >
            <LogOut size={14} /> Выселить {departures.length > 0 && `(${departures.length})`}
          </button>
          <button
            onClick={() => setShowRelocate(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}
          >
            <ArrowRightLeft size={14} /> Переселить
          </button>
          <button
            onClick={() => setShowSale(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}
          >
            <ShoppingBag size={14} /> Продажа
          </button>
          <button
            onClick={() => setShowRefund(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}
          >
            <RotateCcw size={14} /> Возврат
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
            <h3 className="text-[13px] font-bold text-foreground mb-4">Загрузка по дням</h3>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={occChartData} margin={{ left: -15, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="d" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                <Tooltip formatter={(v) => [String(v) + "%", "Загрузка"]} />
                <Area type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gOcc)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-foreground">Ожидается оплата сегодня</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                {payDue.length}
              </span>
            </div>
            {payDueTotal > 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">Долг: {money(payDueTotal)}</p>
            )}
            <div className="flex-1 space-y-0 min-h-[120px]">
              {payDue.slice(0, 5).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const due = paymentDueInfo(b, mskDateKey(), scopedTxns);
                const fromLabel = due.firstUnpaidNightKey
                  ? fmtDate(parseMskDateKey(due.firstUnpaidNightKey))
                  : "";
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    subline={`${money(due.debt)}${due.debtNights > 0 ? ` · ${due.debtNights} н.` : ""}${fromLabel ? ` · с ${fromLabel}` : ""}`}
                    btnLabel="Оплатить"
                    btnColor="#10B981"
                    onAction={() => { setSelBooking(b); setBookingTab("payment"); }}
                  />
                );
              })}
              {payDue.length === 0 && (
                <p className="text-[12px] text-muted-foreground/60 text-center py-8">Нет должников на сегодня</p>
              )}
            </div>
            {payDue.length > 5 && (
              <button
                type="button"
                onClick={() => setQueueMode("payment")}
                className="mt-2 text-[11px] font-bold text-primary hover:underline text-left"
              >
                Все ({payDue.length}) →
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-foreground">Заезды сегодня</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFFBEB", color: "#D97706" }}>{arrivals.length}</span>
            </div>
            <div className="space-y-0">
              {arrivals.slice(0, 4).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    btnLabel="Заселить"
                    btnColor="#F59E0B"
                    onAction={() => setCheckInBooking(b)}
                  />
                );
              })}
              {arrivals.length === 0 && <p className="text-[12px] text-muted-foreground/60 text-center py-4">Нет записей</p>}
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-foreground">Выезды сегодня</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: "#2563EB" }}>{departures.length}</span>
            </div>
            <div className="space-y-0">
              {departures.slice(0, 4).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    btnLabel="Выселить"
                    btnColor="#3B82F6"
                    onAction={() => { setSelBooking(b); setBookingTab("details"); }}
                  />
                );
              })}
              {departures.length === 0 && <p className="text-[12px] text-muted-foreground/60 text-center py-4">Нет записей</p>}
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-foreground">Скоро оплата / выезд завтра</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(parseMskDateKey(tomorrowKey))}</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED" }}>
                {stayReminders.length}
              </span>
            </div>
            <div className="space-y-0">
              {stayReminders.slice(0, 4).map(({ booking: b, kinds }) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const kindLabels = kinds.map((k) => STAY_REMINDER_LABEL[k]).join(" · ");
                const soon = kinds.includes("paymentSoon") ? paymentSoonInfo(b, mskDateKey(), scopedTxns) : null;
                const subline = [
                  kindLabels,
                  soon?.paidThroughKey
                    ? `до ${fmtDate(parseMskDateKey(soon.paidThroughKey))} 12:00`
                    : "",
                ].filter(Boolean).join(" · ");
                const payFirst = kinds.includes("paymentSoon");
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    subline={subline}
                    btnLabel={payFirst ? "Оплатить" : "Бронь"}
                    btnColor={payFirst ? "#10B981" : "#6366F1"}
                    onAction={() => {
                      setSelBooking(b);
                      setBookingTab(payFirst ? "payment" : "details");
                    }}
                  />
                );
              })}
              {stayReminders.length === 0 && (
                <p className="text-[12px] text-muted-foreground/60 text-center py-4">Нет записей</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {showNewBooking && <NewBookingModal onClose={() => setShowNewBooking(false)} />}
      {checkInBooking && <CheckInModal booking={checkInBooking} onClose={() => setCheckInBooking(null)} />}
      {selBooking && <BookingModal booking={selBooking} initialTab={bookingTab} onClose={() => setSelBooking(null)} />}
      {queueMode && <QueueModal mode={queueMode} onClose={() => setQueueMode(null)} />}
      {showSale && <SaleModal onClose={() => setShowSale(false)} />}
      {showRefund && <RefundModal onClose={() => setShowRefund(false)} />}
      {showRelocate && <RelocateModal onClose={() => setShowRelocate(false)} />}
    </>
  );
}
