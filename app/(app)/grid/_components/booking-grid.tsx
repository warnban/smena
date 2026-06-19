"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Search,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { useApp } from "@/components/providers/app-data";
import { BookingModal } from "@/components/modals/booking-modal";
import { fmtDate, dayDiff } from "@/lib/format";
import { ROOM_STATUS } from "@/lib/constants";
import { sourceStyle } from "@/lib/booking-sources";
import type { Booking } from "@/lib/types";
import { activeCategoryCodes } from "@/lib/room-categories";
import { Select } from "@/components/ui/select";

const GC_W = 38;
const GR_H = 26;
const GH_H = 46;
const GA_H = 20;
const GCAT_H = 22;
const GLABEL_W = 196;
const G_TOTAL = 365;
const STD_CHECKIN_H = 14;
const STD_CHECKOUT_H = 12;

export function BookingGridView() {
  const { bookings, rooms, hotelId, loading, roomCategories, getCategoryLabel, sourceConfig } = useApp();
  const TODAY = useMemo(() => new Date(), []);
  const G_ANCHOR = useMemo(() => {
    const a = new Date(TODAY);
    a.setDate(a.getDate() - 180);
    return a;
  }, [TODAY]);
  const G_DEFAULT_PX = 173 * GC_W;

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );
  const scopedRooms = useMemo(
    () => (hotelId === "all" ? rooms : rooms.filter((r) => r.hotelId === hotelId)),
    [rooms, hotelId]
  );

  const catOrder = useMemo(() => activeCategoryCodes(roomCategories), [roomCategories]);

  const [catF, setCatF] = useState("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [pxSnap, setPxSnap] = useState(G_DEFAULT_PX);
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<Booking | null>(null);

  const headerTransRef = useRef<HTMLDivElement>(null);
  const rowsTransRef = useRef<HTMLDivElement>(null);
  const pxLive = useRef(G_DEFAULT_PX);
  const dragStartX = useRef(0);
  const dragStartPx = useRef(G_DEFAULT_PX);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  function applyPan(px: number) {
    const t = `translateX(-${px}px)`;
    if (headerTransRef.current) headerTransRef.current.style.transform = t;
    if (rowsTransRef.current) rowsTransRef.current.style.transform = t;
  }

  function navigate(days: number) {
    const next = Math.max(0, Math.min(pxLive.current + days * GC_W, (G_TOTAL - 25) * GC_W));
    pxLive.current = next;
    setPxSnap(next);
  }
  function goToday() {
    pxLive.current = G_DEFAULT_PX;
    setPxSnap(G_DEFAULT_PX);
  }

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartPx.current = pxLive.current;
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const delta = dragStartX.current - e.clientX;
    const newPx = Math.max(0, Math.min(dragStartPx.current + delta, (G_TOTAL - 25) * GC_W));
    pxLive.current = newPx;
    applyPan(newPx);
  }
  function onMouseUp() {
    if (!isDragging) return;
    setIsDragging(false);
    const snapped = Math.round(pxLive.current / GC_W) * GC_W;
    pxLive.current = snapped;
    setPxSnap(snapped);
  }

  const allDates = useMemo(
    () =>
      Array.from({ length: G_TOTAL }, (_, i) => {
        const dt = new Date(G_ANCHOR);
        dt.setDate(dt.getDate() + i);
        return dt;
      }),
    [G_ANCHOR]
  );

  function barPos(b: Booking) {
    const startIdx = dayDiff(G_ANCHOR, b.checkIn);
    const endIdx = dayDiff(G_ANCHOR, b.checkOut);
    const left = startIdx * GC_W + (b.checkInHour / 24) * GC_W;
    const right = endIdx * GC_W + (b.checkOutHour / 24) * GC_W;
    if (right <= left + 2) return null;
    const stdCiX = startIdx * GC_W + (STD_CHECKIN_H / 24) * GC_W;
    const stdCoX = endIdx * GC_W + (STD_CHECKOUT_H / 24) * GC_W;
    const earlyW = b.checkInHour < STD_CHECKIN_H ? Math.max(0, stdCiX - left) : 0;
    const lateW = b.checkOutHour > STD_CHECKOUT_H ? Math.max(0, right - stdCoX) : 0;
    const lateOff = Math.max(0, stdCoX - left);
    return { left, width: right - left, earlyW, lateW, lateOff, nights: dayDiff(b.checkIn, b.checkOut) };
  }

  const availMap = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const cat of catOrder) {
      const catRooms = scopedRooms.filter((r) => r.category === cat);
      const counts = new Array(G_TOTAL).fill(catRooms.length);
      for (const bk of scopedBookings) {
        if (bk.status === "cancelled") continue;
        const room = scopedRooms.find((r) => r.id === bk.roomId);
        if (!room || room.category !== cat) continue;
        const s = Math.max(0, dayDiff(G_ANCHOR, bk.checkIn));
        const e = Math.min(G_TOTAL - 1, dayDiff(G_ANCHOR, bk.checkOut));
        for (let i = s; i < e; i++) counts[i] = Math.max(0, counts[i] - 1);
      }
      m[cat] = counts;
    }
    return m;
  }, [scopedRooms, scopedBookings, G_ANCHOR, catOrder]);

  const filteredRooms = scopedRooms.filter((r) => catF === "all" || r.category === catF);
  const bksFor = (roomId: string) =>
    scopedBookings.filter(
      (b) => b.roomId === roomId && (!search || b.guestName.toLowerCase().includes(search.toLowerCase()))
    );

  const todayDayIdx = dayDiff(G_ANCHOR, TODAY);
  const timeFrac = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const timeX = todayDayIdx * GC_W + timeFrac * GC_W;
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const visStartDt = allDates[Math.min(Math.floor(pxSnap / GC_W) + 5, G_TOTAL - 1)];
  const monthLabel = visStartDt?.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) ?? "";
  const canvasW = G_TOTAL * GC_W;
  const transStyle: React.CSSProperties = { transform: `translateX(-${pxSnap}px)`, width: canvasW, position: "relative" };
  const gridBg: React.CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${GC_W - 1}px, hsl(var(--border)) ${GC_W - 1}px, hsl(var(--border)) ${GC_W}px)`,
    backgroundSize: `${GC_W}px 100%`,
  };

  if (loading) {
    return (
      <>
        <TopBar title="Шахматка бронирований" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden select-none">
        <TopBar title="Шахматка бронирований">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-30)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted border border-border"><ChevronLeft size={13} /><ChevronLeft size={13} style={{ marginLeft: -6 }} /></button>
            <button onClick={() => navigate(-7)} className="px-2 py-1 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-muted border border-border"><ChevronLeft size={13} /> −7</button>
            <span className="text-[12px] font-bold text-foreground px-2 capitalize w-40 text-center">{monthLabel}</span>
            <button onClick={() => navigate(7)} className="px-2 py-1 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-muted border border-border">+7 <ChevronRight size={13} /></button>
            <button onClick={() => navigate(30)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted border border-border"><ChevronRight size={13} /><ChevronRight size={13} style={{ marginLeft: -6 }} /></button>
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary hover:bg-accent border border-primary/30">Сегодня</button>
          </div>
        </TopBar>

        <div className="bg-card px-4 py-1.5 flex items-center gap-2 flex-shrink-0 border-b border-border">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Гость или номер..." className="pl-6 pr-2 py-1 text-[11px] rounded-lg outline-none w-36 bg-muted border border-border text-foreground" />
          </div>
          <Select
            size="sm"
            value={catF}
            onChange={setCatF}
            options={[
              { value: "all", label: "Все категории" },
              ...catOrder.map((cat) => ({ value: cat, label: getCategoryLabel(cat) })),
            ]}
            className="w-auto"
          />
          <div className="ml-auto flex items-center gap-3">
            {Object.entries(sourceConfig).map(([k, s]) => (
              <div key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="w-3 h-2.5 rounded-sm" style={{ background: s.solid }} /> {s.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-shrink-0 flex flex-col bg-card z-10 border-r-2 border-border" style={{ width: GLABEL_W }}>
            <div className="flex-shrink-0 flex items-end px-3 pb-1 bg-muted border-b-2 border-border" style={{ height: GH_H }}>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Номер / Статус</span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
              {catOrder.map((cat) => {
                const catRooms = filteredRooms.filter((r) => r.category === cat);
                if (!catRooms.length) return null;
                const isOpen = !collapsed.has(cat);
                const total = scopedRooms.filter((r) => r.category === cat).length;
                return (
                  <div key={cat}>
                    <div className="flex items-center px-2 gap-1 bg-muted/80 border-b border-border" style={{ height: GCAT_H }}>
                      <button onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })} className="flex items-center gap-1 flex-1 text-left">
                        {isOpen ? <ChevronDown size={11} className="text-muted-foreground" /> : <ChevronRight size={11} className="text-muted-foreground" />}
                        <span className="text-[11px] font-bold text-foreground">{getCategoryLabel(cat)}</span>
                      </button>
                      <span className="text-[10px] text-muted-foreground">{total}</span>
                    </div>
                    {isOpen && (
                      <div className="flex items-center px-3 bg-muted/40 border-b border-border/60" style={{ height: GA_H }}>
                        <span className="text-[10px] text-muted-foreground">Своб.</span>
                      </div>
                    )}
                    {isOpen && catRooms.map((room) => {
                      const rs = ROOM_STATUS[room.status];
                      return (
                        <div key={room.id} className="flex items-center px-2 gap-1.5 hover:bg-muted/50 transition-colors border-b border-border/40" style={{ height: GR_H }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: rs.color, fontSize: 9, fontWeight: 900 }}>{room.number.slice(-2)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-foreground truncate leading-tight">№{room.number}</div>
                            <div className="text-[9px] text-muted-foreground leading-tight">{room.floor}эт · {(room.price / 1000).toFixed(1)}k</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden" style={{ cursor: isDragging ? "grabbing" : "grab" }} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <div className="flex-shrink-0 overflow-hidden bg-muted border-b-2 border-border" style={{ height: GH_H }}>
              <div ref={headerTransRef} style={transStyle}>
                {allDates.map((dt, i) => {
                  const isToday = dt.toDateString() === TODAY.toDateString();
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isMonthStart = dt.getDate() === 1;
                  return (
                    <div key={i} style={{ position: "absolute", left: i * GC_W, width: GC_W, top: 0, height: GH_H, background: isToday ? "rgba(59,130,246,0.1)" : isWeekend ? "hsl(var(--muted))" : undefined, borderRight: "1px solid hsl(var(--border))" }}>
                      {isMonthStart && <div className="absolute left-1 top-1 text-[9px] font-bold text-muted-foreground whitespace-nowrap">{dt.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" })}</div>}
                      <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center">
                        <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? "#2563EB" : isWeekend ? "#EF4444" : undefined }}>{["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][dt.getDay()]}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1, color: isToday ? "#2563EB" : undefined }}>{dt.getDate()}</div>
                      </div>
                      {isToday && (
                        <div style={{ position: "absolute", bottom: 0, left: `${timeFrac * 100}%`, transform: "translateX(-50%)" }}>
                          <div style={{ fontSize: 8, fontWeight: 900, color: "#fff", background: "#EF4444", padding: "1px 3px", borderRadius: 3, whiteSpace: "nowrap" }}>{timeLabel}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
              <div ref={rowsTransRef} style={transStyle}>
                <div style={{ position: "absolute", left: todayDayIdx * GC_W, width: GC_W, top: 0, bottom: 0, background: "rgba(59,130,246,0.04)", pointerEvents: "none", zIndex: 1 }} />
                <div style={{ position: "absolute", left: timeX, width: 2, top: 0, bottom: 0, background: "rgba(239,68,68,0.7)", pointerEvents: "none", zIndex: 15 }} />

                {catOrder.map((cat) => {
                  const catRooms = filteredRooms.filter((r) => r.category === cat);
                  if (!catRooms.length) return null;
                  const isOpen = !collapsed.has(cat);
                  const avail = availMap[cat] ?? [];
                  return (
                    <div key={cat}>
                      <div style={{ height: GCAT_H, ...gridBg, backgroundColor: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))", position: "relative" }} />
                      {isOpen && (
                        <div style={{ height: GA_H, position: "relative", background: "hsl(var(--muted)/0.5)", borderBottom: "1px solid hsl(var(--border)/0.6)" }}>
                          {allDates.map((_, i) => {
                            const a = avail[i] ?? 0;
                            const total = scopedRooms.filter((r) => r.category === cat).length;
                            const color = a === 0 ? "#EF4444" : a === total ? "#10B981" : "#F59E0B";
                            return (
                              <div key={i} style={{ position: "absolute", left: i * GC_W, width: GC_W, height: GA_H, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid hsl(var(--border)/0.5)" }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color }}>{a}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isOpen && catRooms.map((room) => {
                        const rbs = bksFor(room.id);
                        return (
                          <div key={room.id} style={{ height: GR_H, position: "relative", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>
                            <div style={{ position: "absolute", inset: 0, ...gridBg }} />
                            {rbs.map((bk) => {
                              const pos = barPos(bk);
                              if (!pos) return null;
                              const src = sourceStyle(sourceConfig, bk.source);
                              return (
                                <button
                                  key={bk.id}
                                  onClick={(e) => { e.stopPropagation(); setSelected(bk); }}
                                  style={{ position: "absolute", left: pos.left, width: pos.width, top: 3, height: GR_H - 6, background: src.bg, border: `1px solid ${src.border}`, borderLeft: `3px solid ${src.solid}`, borderRadius: 4, overflow: "hidden", zIndex: 5, cursor: "pointer" }}
                                  className="flex items-center px-1.5 gap-1 hover:shadow-md hover:brightness-95 transition-all text-left"
                                  title={`${bk.guestName} · ${fmtDate(bk.checkIn, true)} → ${fmtDate(bk.checkOut, true)}`}
                                >
                                  {pos.earlyW > 1 && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pos.earlyW, background: "rgba(0,0,0,0.13)", borderRadius: "3px 0 0 3px", pointerEvents: "none" }} />}
                                  {pos.lateW > 1 && <div style={{ position: "absolute", left: pos.lateOff, top: 0, bottom: 0, width: pos.lateW, background: "rgba(0,0,0,0.13)", borderRadius: "0 3px 3px 0", pointerEvents: "none" }} />}
                                  {pos.width > 36 && <span style={{ fontSize: 10, fontWeight: 700, color: src.text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1, position: "relative", zIndex: 1 }}>{bk.guestName.split(" ")[0]}</span>}
                                  {pos.width > 90 && <span style={{ fontSize: 9, color: src.text, opacity: 0.6, flexShrink: 0, position: "relative", zIndex: 1 }}>{pos.nights}н</span>}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {selected && <BookingModal booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
