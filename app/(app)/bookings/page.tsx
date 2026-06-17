"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { BookingModal } from "@/components/modals/booking-modal";
import { NewBookingModal } from "@/components/modals/new-booking-modal";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate, inits, dayDiff } from "@/lib/format";
import { SOURCE, BOOKING_ST } from "@/lib/constants";
import type { Booking } from "@/lib/types";
import { Select } from "@/components/ui/select";

export default function BookingsPage() {
  const { bookings, rooms, hotelId, loading, getCategoryLabel } = useApp();
  const [search, setSearch] = useState("");
  const [stF, setStF] = useState("all");
  const [srcF, setSrcF] = useState("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showNew, setShowNew] = useState(false);

  const scoped = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );

  const filtered = scoped
    .filter(
      (b) =>
        (stF === "all" || b.status === stF) &&
        (srcF === "all" || b.source === srcF) &&
        (!search || b.guestName.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());

  if (loading) {
    return (
      <>
        <TopBar title="Бронирования" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Бронирования" subtitle={`${scoped.length} всего`} />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по гостю..." className="w-full sm:w-48 pl-7 pr-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground" />
          </div>
          <Select
            size="sm"
            value={stF}
            onChange={setStF}
            options={[
              { value: "all", label: "Все статусы" },
              ...Object.entries(BOOKING_ST).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
            className="w-auto"
          />
          <Select
            size="sm"
            value={srcF}
            onChange={setSrcF}
            options={[
              { value: "all", label: "Все источники" },
              ...Object.entries(SOURCE).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
            className="w-auto"
          />
          <button onClick={() => setShowNew(true)} className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-white text-[12px] font-bold rounded-lg shadow-sm hover:opacity-90" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}><Plus size={13} /> Новое</button>
        </div>
        <div className="bg-card rounded-xl overflow-hidden border border-border overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-muted border-b-2 border-border">
              <tr>{["#", "Гость", "Номер", "Даты", "Н", "Источник", "Статус", "Сумма", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const src = SOURCE[b.source];
                const debt = b.amount - b.paid;
                const nights = dayDiff(b.checkIn, b.checkOut);
                return (
                  <tr key={b.id} onClick={() => setSelected(b)} className="cursor-pointer hover:bg-muted/50 border-b border-border/50">
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{b.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "#EFF6FF", color: "#2563EB" }}>{inits(b.guestName)}</div>
                        <div><div className="text-[13px] font-semibold text-foreground">{b.guestName}</div><div className="text-[10px] text-muted-foreground">{b.guests} гост.</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground/80">№{room?.number} · {room ? getCategoryLabel(room.category) : ""}</td>
                    <td className="px-4 py-3 text-[12px] text-foreground/80 whitespace-nowrap">{fmtDate(b.checkIn, true)} — {fmtDate(b.checkOut, true)}</td>
                    <td className="px-4 py-3 text-[12px] font-bold text-foreground/80">{nights}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ background: src.solid }}>{src.label}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3"><div className="text-[13px] font-black text-foreground">{money(b.amount)}</div>{debt > 0 && <div className="text-[11px] font-bold text-destructive">−{money(debt)}</div>}</td>
                    <td className="px-4 py-3"><button className="text-[12px] font-bold text-primary hover:underline">Открыть</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <BookingModal booking={selected} onClose={() => setSelected(null)} />}
      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}
    </>
  );
}
