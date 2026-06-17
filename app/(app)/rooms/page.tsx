"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { RoomFormModal } from "@/components/modals/room-form-modal";
import { useApp } from "@/components/providers/app-data";
import { money } from "@/lib/format";
import { DORM_GENDER_LABELS, ROOM_KIND_LABELS, ROOM_STATUS } from "@/lib/constants";
import { bedCardStatusLabel } from "@/lib/dorm";
import { activeCategoryCodes } from "@/lib/room-categories";
import type { Bed, Room, RoomStatus } from "@/lib/types";
import { Select } from "@/components/ui/select";

function compareRooms(a: Room, b: Room): number {
  if (a.floor !== b.floor) return a.floor - b.floor;
  return a.number.localeCompare(b.number, "ru", { numeric: true, sensitivity: "base" });
}

function groupByFloor(rooms: Room[]): { floor: number; rooms: Room[] }[] {
  const map = new Map<number, Room[]>();
  for (const r of rooms) {
    const list = map.get(r.floor) ?? [];
    list.push(r);
    map.set(r.floor, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([floor, list]) => ({ floor, rooms: [...list].sort(compareRooms) }));
}

export default function RoomsPage() {
  const { rooms, beds, bookings, hotelId, loading, session, roomCategories, getCategoryLabel } = useApp();
  const [stF, setStF] = useState("all");
  const [catF, setCatF] = useState("all");
  const [kindF, setKindF] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);

  const canWrite = session?.role === "owner" || session?.role === "manager" || session?.role === "admin";

  const scoped = useMemo(
    () => (hotelId === "all" ? rooms : rooms.filter((r) => r.hotelId === hotelId)),
    [rooms, hotelId]
  );

  const catOrder = useMemo(() => activeCategoryCodes(roomCategories), [roomCategories]);

  const bedsByRoom = useMemo(() => {
    const map = new Map<string, Bed[]>();
    for (const b of beds) {
      const list = map.get(b.roomId) ?? [];
      list.push(b);
      map.set(b.roomId, list);
    }
    Array.from(map.values()).forEach((list) => {
      list.sort((a: Bed, b: Bed) => a.label.localeCompare(b.label, "ru", { numeric: true }));
    });
    return map;
  }, [beds]);

  const guestByBedId = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      if (!b.bedId || b.status !== "checkedin") continue;
      map.set(b.bedId, b.guestName);
    }
    return map;
  }, [bookings]);

  const filtered = useMemo(() => {
    return scoped
      .filter(
        (r) =>
          (stF === "all" || r.status === stF) &&
          (catF === "all" || r.category === catF) &&
          (kindF === "all" || r.kind === kindF)
      )
      .sort(compareRooms);
  }, [scoped, stF, catF, kindF]);

  const floorGroups = useMemo(() => groupByFloor(filtered), [filtered]);

  const counts = (Object.keys(ROOM_STATUS) as RoomStatus[]).reduce(
    (a, k) => ({ ...a, [k]: scoped.filter((r) => r.status === k).length }),
    {} as Record<RoomStatus, number>
  );

  const dormCount = scoped.filter((r) => r.kind === "dorm").length;
  const privateCount = scoped.filter((r) => r.kind !== "dorm").length;

  if (loading) {
    return (
      <>
        <TopBar title="Номерной фонд" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Номерной фонд" subtitle={`${scoped.length} объектов · ${privateCount} номеров · ${dormCount} общих комнат`} />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {(Object.entries(ROOM_STATUS) as [RoomStatus, (typeof ROOM_STATUS)[string]][]).map(([k, rs]) => (
            <button
              key={k}
              onClick={() => setStF(stF === k ? "all" : k)}
              className={`bg-card rounded-lg px-2 py-2.5 text-center transition-all border ${stF === k ? "shadow-sm" : "border-border hover:border-muted-foreground/30"}`}
              style={{ borderColor: stF === k ? rs.color : undefined }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: rs.color }} />
                <span className="text-[16px] font-black text-foreground leading-none">{counts[k]}</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 truncate" style={{ color: rs.color }}>{rs.label}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={kindF}
            onChange={setKindF}
            options={[
              { value: "all", label: "Все типы" },
              { value: "private", label: ROOM_KIND_LABELS.private! },
              { value: "dorm", label: ROOM_KIND_LABELS.dorm! },
            ]}
            className="w-auto"
          />
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
          {canWrite && (
            <button
              onClick={() => { setEditRoom(null); setShowForm(true); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-white text-[12px] font-bold rounded-lg shadow-sm hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              <Plus size={13} /> Добавить
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Нет объектов по выбранным фильтрам</div>
        ) : (
          <div className="space-y-6">
            {floorGroups.map(({ floor, rooms: floorRooms }) => (
              <section key={floor}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{floor} этаж</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-semibold text-muted-foreground">{floorRooms.length}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 items-stretch">
                  {floorRooms.map((room) => {
                    const rs = ROOM_STATUS[room.status] ?? ROOM_STATUS.available!;
                    const isDorm = room.kind === "dorm";
                    const roomBedList = bedsByRoom.get(room.id) ?? [];

                    return (
                      <article
                        key={room.id}
                        onClick={() => canWrite && (setEditRoom(room), setShowForm(true))}
                        className={`flex flex-col bg-card rounded-lg border border-border overflow-hidden transition-shadow ${canWrite ? "cursor-pointer hover:shadow-md hover:border-muted-foreground/25" : ""}`}
                      >
                        {/* Шапка */}
                        <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-2 border-b border-border/60">
                          <div
                            className="w-1 self-stretch rounded-full shrink-0 min-h-[28px]"
                            style={{ background: isDorm ? "#8B5CF6" : rs.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[13px] font-black text-foreground truncate">
                                {isDorm ? room.number : `№${room.number}`}
                              </span>
                              <span className="text-[11px] font-bold text-foreground shrink-0">
                                {money(room.price)}
                                <span className="text-[9px] text-muted-foreground font-normal">{isDorm ? "/к" : "/н"}</span>
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {isDorm
                                ? `${DORM_GENDER_LABELS[room.dormGender ?? "mixed"]} · ${roomBedList.length} мест`
                                : `${getCategoryLabel(room.category)} · ${rs.label}`}
                            </p>
                          </div>
                        </div>

                        {/* Тело — фиксированная мин. высота для выравнивания строк */}
                        <div className="flex-1 px-2.5 py-2 min-h-[52px]">
                          {isDorm ? (
                            roomBedList.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1">
                                {roomBedList.map((bed) => {
                                  const guestName = guestByBedId.get(bed.id) ?? null;
                                  const label = bedCardStatusLabel(bed.status, guestName);
                                  const bedRs = ROOM_STATUS[bed.status] ?? ROOM_STATUS.available!;
                                  const isGuest = Boolean(guestName);
                                  return (
                                    <div
                                      key={bed.id}
                                      className="flex items-center gap-1 min-w-0 rounded px-1.5 py-1 bg-muted/40"
                                      title={`№${bed.label} — ${label}`}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: bedRs.color }}
                                      />
                                      <span className="text-[10px] font-bold text-foreground shrink-0">{bed.label}</span>
                                      <span
                                        className={`text-[9px] truncate ${isGuest ? "text-foreground font-medium" : "text-muted-foreground"}`}
                                        style={!isGuest && bed.status !== "available" ? { color: bedRs.color } : undefined}
                                      >
                                        {isGuest ? label.split(" ").slice(0, 2).join(" ") : label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Нет коек</p>
                            )
                          ) : (
                            room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {room.amenities.slice(0, 3).map((a) => (
                                  <span key={a} className="text-[9px] font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-full">
                                    {a}
                                  </span>
                                ))}
                                {room.amenities.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground">+{room.amenities.length - 3}</span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <RoomFormModal
          room={editRoom}
          defaultHotelId={hotelId === "all" ? undefined : hotelId}
          onClose={() => { setShowForm(false); setEditRoom(null); }}
        />
      )}
    </>
  );
}
