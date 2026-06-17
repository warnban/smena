"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw, FileText, Trash2, AlertTriangle } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { money, fmtDateRu, startOfDay } from "@/lib/format";
import { useApp } from "@/components/providers/app-data";
import { otaDisplayStatus, OTA_STATUS_LABELS, isOtaBooking } from "@/lib/ota";
import { buildOtaCheckoutReport, printOtaReport } from "@/lib/ota-report";
import type { Booking } from "@/lib/types";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ChannelsPage() {
  const { channels, bookings, hotels, hotelId, loading, refresh, canManageSettings } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newCommission, setNewCommission] = useState("15");
  const [statusF, setStatusF] = useState<"all" | "booking" | "staying" | "departed">("all");
  const [range, setRange] = useState(defaultRange);
  const [showReport, setShowReport] = useState(false);

  const activeHotel = hotelId !== "all" ? hotels.find((h) => h.id === hotelId) : null;
  const scopedChannels = useMemo(
    () => (activeHotel ? channels.filter((c) => c.hotelId === activeHotel.id) : []),
    [channels, activeHotel]
  );

  const channelById = useMemo(() => new Map(scopedChannels.map((c) => [c.id, c])), [scopedChannels]);

  const dateFrom = useMemo(() => startOfDay(new Date(range.from)), [range.from]);
  const dateTo = useMemo(() => {
    const d = startOfDay(new Date(range.to));
    d.setHours(23, 59, 59, 999);
    return d;
  }, [range.to]);

  const otaBookings = useMemo(() => {
    if (!activeHotel) return [];
    return bookings.filter((b) => {
      if (b.hotelId !== activeHotel.id || b.status === "cancelled") return false;
      if (!isOtaBooking(b.source, b.channelId)) return false;
      const stayStart = startOfDay(new Date(b.checkIn));
      const stayEnd = startOfDay(new Date(b.checkOut));
      return stayStart <= dateTo && stayEnd >= dateFrom;
    });
  }, [bookings, activeHotel, dateFrom, dateTo]);

  const filteredBookings = useMemo(() => {
    if (statusF === "all") return otaBookings;
    return otaBookings.filter((b) => otaDisplayStatus(b.status) === statusF);
  }, [otaBookings, statusF]);

  const reportSections = useMemo(() => {
    if (!activeHotel || !showReport) return [];
    return buildOtaCheckoutReport(bookings, channels, activeHotel.id, dateFrom, dateTo);
  }, [bookings, channels, activeHotel, dateFrom, dateTo, showReport]);

  const totals = useMemo(() => ({
    revenue: scopedChannels.reduce((s, c) => s + c.revenueMonth, 0),
    bookings: scopedChannels.reduce((s, c) => s + c.bookingsMonth, 0),
    active: scopedChannels.filter((c) => c.status === "ok").length,
  }), [scopedChannels]);

  function channelName(b: Booking) {
    if (b.channelId && channelById.get(b.channelId)) return channelById.get(b.channelId)!.name;
    const byCode = scopedChannels.find((c) => c.code === b.source);
    return byCode?.name ?? b.source;
  }

  function channelColor(b: Booking) {
    if (b.channelId && channelById.get(b.channelId)) return channelById.get(b.channelId)!.color;
    return scopedChannels.find((c) => c.code === b.source)?.color ?? "#64748B";
  }

  async function syncAll() {
    setSyncing(true);
    try {
      await fetch("/api/channels/sync", { method: "POST" });
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function addChannel() {
    if (!activeHotel || !newName.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: activeHotel.id,
        name: newName.trim(),
        commission: Number(newCommission) || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Ошибка");
    else {
      setNewName("");
      await refresh();
    }
    setBusy(false);
  }

  async function removeChannel(id: string) {
    if (!confirm("Удалить канал?")) return;
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Не удалось удалить");
    else await refresh();
  }

  if (loading) {
    return (
      <>
        <TopBar title="Менеджер каналов (OTA)" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Менеджер каналов (OTA)"
        subtitle={activeHotel ? activeHotel.name : "Выберите отель в переключателе"}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {hotelId === "all" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30 text-[13px]">
            <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-foreground">Выберите конкретный отель</strong>
              <p className="text-muted-foreground mt-0.5">Каналы и брони OTA привязаны к отелю — переключите отель в меню слева.</p>
            </div>
          </div>
        )}

        {activeHotel && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KpiCard label="Каналов" value={String(scopedChannels.length)} sub={`${totals.active} активных`} />
              <KpiCard label="Доход/мес" value={money(totals.revenue)} sub="по каналам" accent="#059669" />
              <KpiCard label="Брон./мес" value={String(totals.bookings)} sub="OTA" accent="#2563EB" />
            </div>

            {/* Партнёры / каналы */}
            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-5 py-3.5 flex items-center justify-between bg-muted border-b-2 border-border">
                <h3 className="text-[13px] font-bold text-foreground">Партнёры (каналы продаж)</h3>
                <button
                  onClick={syncAll}
                  disabled={syncing}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Синхронизировать
                </button>
              </div>
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    {["Канал", "Комиссия", "Брон./мес", "Выручка/мес", "Статус", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scopedChannels.map((ch) => (
                    <tr key={ch.id} className="hover:bg-muted/50 border-b border-border/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3.5 h-3.5 rounded" style={{ background: ch.color }} />
                          <span className="text-[13px] font-bold text-foreground">{ch.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{ch.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-bold text-destructive">{ch.commission}%</td>
                      <td className="px-4 py-3 text-[13px] font-bold">{ch.bookingsMonth}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-success">{money(ch.revenueMonth)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ch.status === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {ch.status === "ok" ? "Активен" : "Ошибка"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canManageSettings && (
                          <button onClick={() => removeChannel(ch.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10" title="Удалить">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {scopedChannels.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Нет каналов — добавьте первого партнёра</td></tr>
                  )}
                </tbody>
              </table>
              {canManageSettings && (
                <div className="px-5 py-4 border-t border-border bg-muted/30 flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Название канала</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Booking.com, Твил…" className="w-full px-3 py-2 text-[12px] rounded-xl border border-border bg-card outline-none" />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Комиссия %</label>
                    <input type="number" min={0} max={100} value={newCommission} onChange={(e) => setNewCommission(e.target.value)} className="w-full px-3 py-2 text-[12px] rounded-xl border border-border bg-card outline-none" />
                  </div>
                  <button onClick={addChannel} disabled={busy || !newName.trim()} className="flex items-center gap-1.5 px-4 py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">
                    <Plus size={13} /> Добавить
                  </button>
                </div>
              )}
              {error && <p className="px-5 pb-3 text-[12px] text-destructive font-semibold">{error}</p>}
            </div>

            {/* Брони OTA */}
            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-muted border-b-2 border-border">
                <h3 className="text-[13px] font-bold text-foreground">Брони с агрегаторов</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
                  <span className="text-muted-foreground text-[12px]">—</span>
                  <DatePicker value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
                  <Select
                    size="sm"
                    value={statusF}
                    onChange={(v) => setStatusF(v as typeof statusF)}
                    options={[
                      { value: "all", label: "Все статусы" },
                      { value: "booking", label: "Бронирование" },
                      { value: "staying", label: "Живёт" },
                      { value: "departed", label: "Выехал" },
                    ]}
                    className="w-auto"
                  />
                  <button
                    onClick={() => {
                      setShowReport(true);
                      const sections = buildOtaCheckoutReport(bookings, channels, activeHotel.id, dateFrom, dateTo);
                      printOtaReport(sections, activeHotel.name, dateFrom, dateTo);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-lg border border-primary/40 text-primary hover:bg-accent"
                  >
                    <FileText size={13} /> Сформировать отчёт
                  </button>
                </div>
              </div>
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    {["Канал", "Гость", "Заезд — выезд", "Сумма", "Статус"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => {
                    const st = otaDisplayStatus(b.status);
                    const cfg = OTA_STATUS_LABELS[st];
                    return (
                      <tr key={b.id} className="hover:bg-muted/50 border-b border-border/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: channelColor(b) }} />
                            <span className="text-[12px] font-semibold">{channelName(b)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-foreground">{b.guestName}</td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground">{fmtDateRu(b.checkIn)} — {fmtDateRu(b.checkOut)}</td>
                        <td className="px-4 py-3 text-[13px] font-bold">{money(b.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBookings.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-muted-foreground">Нет броней за выбранный период</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Превью отчёта */}
            {showReport && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-foreground">Отчёт по выездам · {fmtDateRu(dateFrom)} — {fmtDateRu(dateTo)}</h3>
                  <button
                    onClick={() => printOtaReport(reportSections, activeHotel.name, dateFrom, dateTo)}
                    className="text-[12px] font-bold text-primary hover:underline"
                  >
                    Печать
                  </button>
                </div>
                {reportSections.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">За период нет выехавших гостей с OTA-каналов</p>
                ) : (
                  reportSections.map((sec) => (
                    <div key={sec.channelId}>
                      <h4 className="text-[13px] font-black mb-2 flex items-center gap-2" style={{ color: sec.color }}>
                        <span className="w-3 h-3 rounded" style={{ background: sec.color }} />
                        {sec.channelName}
                      </h4>
                      <table className="w-full text-[12px] mb-1">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                            <th className="text-left py-2 pr-3 w-28">Дата</th>
                            <th className="text-left py-2 pr-3">ФИО</th>
                            <th className="text-left py-2 pr-3">Даты проживания</th>
                            <th className="text-right py-2">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const byDate = new Map<string, typeof sec.lines>();
                            for (const line of sec.lines) {
                              const k = fmtDateRu(line.entryDate);
                              const arr = byDate.get(k) ?? [];
                              arr.push(line);
                              byDate.set(k, arr);
                            }
                            return Array.from(byDate.entries()).flatMap(([dateKey, lines]) =>
                              lines.map((line, idx) => (
                                <tr key={`${dateKey}-${line.guestName}`} className="border-b border-border/40">
                                  <td className="py-2 pr-3 font-semibold text-foreground">{idx === 0 ? dateKey : ""}</td>
                                  <td className="py-2 pr-3">{line.guestName}</td>
                                  <td className="py-2 pr-3 text-muted-foreground">{fmtDateRu(line.stayFrom)} — {fmtDateRu(line.stayTo)}</td>
                                  <td className="py-2 text-right font-bold">{money(line.amount)}</td>
                                </tr>
                              ))
                            );
                          })()}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="pt-2 text-right font-bold text-muted-foreground">Итого по каналу:</td>
                            <td className="pt-2 text-right font-black text-success">{money(sec.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))
                )}
                {reportSections.length > 0 && (
                  <div className="pt-3 border-t-2 border-primary/20 flex justify-between items-center">
                    <span className="text-[13px] font-bold text-foreground">Общая сумма выручки</span>
                    <span className="text-[18px] font-black text-primary">{money(reportSections.reduce((s, x) => s + x.total, 0))}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
