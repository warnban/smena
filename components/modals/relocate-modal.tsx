"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ArrowRightLeft, Search, BedDouble } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { DORM_GENDER_LABELS } from "@/lib/constants";
import { guestGenderMatchesDorm } from "@/lib/dorm";
import { fmtDate, inits } from "@/lib/format";
import type { Booking } from "@/lib/types";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type AvailSlot = {
  roomId: string;
  bedId: string | null;
  kind: "private" | "dorm";
  number: string;
  bedLabel: string | null;
};

type TargetRoom = {
  roomId: string;
  number: string;
  kind: "private" | "dorm";
  dormGender: string | null;
  beds: { bedId: string; label: string }[];
};

export function RelocateModal({ onClose }: { onClose: () => void }) {
  const { bookings, rooms, beds, guests, hotelId, hotels, refresh, getCategoryLabel } = useApp();
  const [query, setQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newRoomId, setNewRoomId] = useState("");
  const [newBedId, setNewBedId] = useState("");
  const [availSlots, setAvailSlots] = useState<AvailSlot[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const today = useMemo(() => startOfToday(), []);
  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";

  const staying = useMemo(() => {
    const scoped = hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId);
    return scoped.filter(
      (b) => b.status === "checkedin" && new Date(b.checkOut) >= today
    );
  }, [bookings, hotelId, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staying;
    return staying.filter((b) => {
      const guest = guests.find((g) => g.id === b.guestId);
      const hay = [b.guestName, guest?.phone, guest?.email].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [staying, query, guests]);

  const fromRoom = selectedBooking ? rooms.find((r) => r.id === selectedBooking.roomId) : null;
  const fromBed = selectedBooking?.bedId ? beds.find((b) => b.id === selectedBooking.bedId) : null;
  const selectedGuest = selectedBooking ? guests.find((g) => g.id === selectedBooking.guestId) : null;

  const checkInIso = selectedBooking
    ? new Date(selectedBooking.checkIn).toISOString().slice(0, 10)
    : "";
  const checkOutIso = selectedBooking
    ? new Date(selectedBooking.checkOut).toISOString().slice(0, 10)
    : "";

  useEffect(() => {
    if (!selectedBooking || !checkInIso || !checkOutIso) {
      setAvailSlots([]);
      return;
    }

    const params = new URLSearchParams({
      hotelId: selectedBooking.hotelId,
      checkIn: checkInIso,
      checkOut: checkOutIso,
    });
    if (selectedBooking.guestId) params.set("guestId", selectedBooking.guestId);

    let cancelled = false;
    setAvailLoading(true);
    fetch(`/api/rooms/availability?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAvailSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setAvailSlots([]);
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBooking, checkInIso, checkOutIso]);

  const targetRooms = useMemo((): TargetRoom[] => {
    if (!selectedBooking) return [];

    const byRoom = new Map<string, TargetRoom>();

    for (const slot of availSlots) {
      if (slot.roomId === selectedBooking.roomId && slot.kind === "private") continue;

      const room = rooms.find((r) => r.id === slot.roomId);
      if (!room || room.id === selectedBooking.roomId && room.kind !== "dorm") continue;

      if (room.kind === "dorm" && !guestGenderMatchesDorm(selectedGuest?.gender, room.dormGender)) continue;

      let entry = byRoom.get(slot.roomId);
      if (!entry) {
        entry = {
          roomId: slot.roomId,
          number: room.number,
          kind: room.kind,
          dormGender: room.dormGender,
          beds: [],
        };
        byRoom.set(slot.roomId, entry);
      }

      if (slot.bedId && slot.bedLabel) {
        if (slot.bedId === selectedBooking.bedId) continue;
        entry.beds.push({ bedId: slot.bedId, label: slot.bedLabel });
      }
    }

    for (const slot of availSlots) {
      if (slot.kind !== "private" || !slot.roomId) continue;
      if (slot.roomId === selectedBooking.roomId) continue;
      const room = rooms.find((r) => r.id === slot.roomId);
      if (!room) continue;
      if (!byRoom.has(slot.roomId)) {
        byRoom.set(slot.roomId, {
          roomId: slot.roomId,
          number: room.number,
          kind: "private",
          dormGender: null,
          beds: [],
        });
      }
    }

    return Array.from(byRoom.values()).sort((a, b) =>
      a.number.localeCompare(b.number, "ru", { numeric: true })
    );
  }, [availSlots, selectedBooking, rooms, selectedGuest]);

  const selectedTarget = targetRooms.find((r) => r.roomId === newRoomId);
  const isTargetDorm = selectedTarget?.kind === "dorm";

  useEffect(() => {
    setNewBedId("");
  }, [newRoomId]);

  useEffect(() => {
    if (isTargetDorm && selectedTarget?.beds.length === 1) {
      setNewBedId(selectedTarget.beds[0]!.bedId);
    }
  }, [isTargetDorm, selectedTarget]);

  async function submit() {
    setError("");
    if (!selectedBooking) {
      setError("Выберите гостя");
      return;
    }
    if (!newRoomId) {
      setError("Выберите номер или комнату");
      return;
    }
    if (isTargetDorm && !newBedId) {
      setError("Выберите койко-место");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/relocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRoomId,
          newBedId: isTargetDorm ? newBedId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось переселить");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const fromLabel = fromBed ? fromBed.label : fromRoom?.number;
  const toLabel = isTargetDorm
    ? beds.find((b) => b.id === newBedId)?.label ?? selectedTarget?.number
    : selectedTarget?.number;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl flex flex-col w-full max-w-[520px] border border-border max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-[15px] font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-primary" /> Переселение гостя
            </h2>
            <p className="text-[12px] text-muted-foreground">Выберите гостя, комнату и койку (для общих комнат)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {hotelId === "all" && !activeHotelId && (
            <p className="text-[12px] text-destructive font-semibold">Выберите конкретный отель в меню слева</p>
          )}

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Поиск гостя</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ФИО, телефон…"
                className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">Нет проживающих гостей</p>
            ) : (
              filtered.map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const bed = b.bedId ? beds.find((bd) => bd.id === b.bedId) : null;
                const place = bed ? `койка ${bed.label}` : `№${room?.number}`;
                const active = selectedBooking?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBooking(b);
                      setNewRoomId("");
                      setNewBedId("");
                      setError("");
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/50"}`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: "#2563EB" }}>
                      {inits(b.guestName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate">{b.guestName}</div>
                      <div className="text-[11px] text-muted-foreground">{place} · до {fmtDate(b.checkOut, true)}</div>
                    </div>
                    {active && <span className="text-[10px] font-bold text-primary">✓</span>}
                  </button>
                );
              })
            )}
          </div>

          {selectedBooking && fromRoom && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[12px] flex-wrap">
                <span className="font-bold text-foreground">Переселяем из:</span>
                <span className="px-2.5 py-1 rounded-lg font-black text-[13px] bg-destructive/10 text-destructive border border-destructive/20">
                  {fromBed ? `№${fromBed.label}` : `№${fromRoom.number}`}
                </span>
                <span className="text-muted-foreground">
                  {fromRoom.kind === "dorm"
                    ? `комната ${fromRoom.number}`
                    : getCategoryLabel(fromRoom.category)}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <BedDouble size={12} /> Куда переселить
                  {availLoading && <span className="font-normal normal-case text-muted-foreground">· загрузка…</span>}
                </label>
                {targetRooms.length === 0 ? (
                  <p className="text-[12px] text-destructive font-semibold">
                    {availLoading ? "Проверяем доступность…" : "Нет свободных мест"}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {targetRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => setNewRoomId(r.roomId)}
                        className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition-all text-left ${newRoomId === r.roomId ? "border-success bg-success/10 text-success ring-1 ring-success/30" : "border-border hover:bg-muted text-foreground"}`}
                      >
                        {r.kind === "dorm" ? (
                          <>
                            <div>Комн. {r.number}</div>
                            <div className="text-[9px] font-normal opacity-70">
                              {DORM_GENDER_LABELS[r.dormGender ?? "mixed"]} · {r.beds.length} мест
                            </div>
                          </>
                        ) : (
                          <>№{r.number}</>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isTargetDorm && selectedTarget && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Койко-место
                  </label>
                  {selectedTarget.beds.length === 0 ? (
                    <p className="text-[12px] text-destructive font-semibold">Нет свободных коек в этой комнате</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedTarget.beds
                        .sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true }))
                        .map((bed) => (
                          <button
                            key={bed.bedId}
                            type="button"
                            onClick={() => setNewBedId(bed.bedId)}
                            className={`px-2 py-2 rounded-lg text-[12px] font-bold border transition-all ${newBedId === bed.bedId ? "border-success bg-success/10 text-success ring-1 ring-success/30" : "border-border hover:bg-muted text-foreground"}`}
                          >
                            №{bed.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {newRoomId && (isTargetDorm ? newBedId : true) && (
                <div className="flex items-center justify-center gap-3 py-2 text-[13px] font-bold">
                  <span className="text-destructive">№{fromLabel}</span>
                  <ArrowRightLeft size={14} className="text-primary" />
                  <span className="text-success">№{toLabel}</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy || !selectedBooking || !newRoomId || (isTargetDorm && !newBedId)}
            className="flex-1 py-2.5 text-[13px] font-bold rounded-xl text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}
          >
            {busy ? "Переселение…" : "Переселить"}
          </button>
        </div>
      </div>
    </div>
  );
}
