"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Sun, Moon, Sparkles,
  LayoutGrid, Users, Check, Loader2,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { useApp } from "@/components/providers/app-data";
import { fmtDate, inits } from "@/lib/format";
import {
  SHIFT_ROLE_LABELS,
  SHIFT_ROLE_COLORS,
  type ShiftRole,
  type ScheduleEntry,
} from "@/lib/schedule-salary";
import {
  fmtMskDateKey,
  mondayOfMsk,
  mskAddDays,
  mskDateKey,
  parseMskDateKey,
  weekDateKeys,
} from "@/lib/msk-time";
import { ShiftStaffChip, ShiftStaffPicker } from "@/components/schedule/shift-staff-picker";
import type { StaffMember } from "@/lib/types";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type GridEntry = { date: string; staffId: string; role: ShiftRole };
type ViewMode = "days" | "people";
type SaveState = "idle" | "saving" | "saved" | "error";

function StaffAvatar({ person, size = 28 }: { person: StaffMember; size?: number }) {
  const c = person.role === "staff" ? SHIFT_ROLE_COLORS.housekeeping : SHIFT_ROLE_COLORS.day_admin;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: c.bg, color: c.text, border: `1.5px solid ${c.border}` }}
    >
      {person.initials || inits(person.name)}
    </div>
  );
}

export default function SchedulePage() {
  const { staff, hotelId, hotels, loading, canManageSettings } = useApp();
  const [weekStartKey, setWeekStartKey] = useState(() => mondayOfMsk());
  const [entries, setEntries] = useState<GridEntry[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("days");
  const hydratedRef = useRef(false);
  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const activeHotelId = hotelId !== "all" ? hotelId : "";
  const dayKeys = useMemo(() => weekDateKeys(weekStartKey), [weekStartKey]);
  const from = weekStartKey;
  const to = dayKeys[6]!;
  const todayKey = mskDateKey();

  const hotelStaff = useMemo(() => {
    if (!activeHotelId) return [];
    return staff.filter((s) => s.hotelIds.includes(activeHotelId));
  }, [staff, activeHotelId]);

  const admins = useMemo(
    () => hotelStaff.filter((s) => s.role === "admin" || s.role === "manager"),
    [hotelStaff]
  );
  const housekeepers = useMemo(
    () => hotelStaff.filter((s) => s.role === "staff"),
    [hotelStaff]
  );

  const load = useCallback(async () => {
    if (!activeHotelId) return;
    hydratedRef.current = false;
    const res = await fetch(`/api/work-schedule?hotelId=${activeHotelId}&from=${from}&to=${to}`);
    if (!res.ok) return;
    const data = await res.json();
    setEntries(
      (data.entries as ScheduleEntry[]).map((e) => ({
        date: e.date.slice(0, 10),
        staffId: e.staffId,
        role: e.role,
      }))
    );
    hydratedRef.current = true;
    skipSaveRef.current = true;
    setSaveState("idle");
  }, [activeHotelId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async () => {
    if (!activeHotelId || !hydratedRef.current) return;
    setSaveState("saving");
    setError("");
    try {
      const res = await fetch("/api/work-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: activeHotelId, weekStart: from, entries: entriesRef.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        setSaveState("error");
        return;
      }
      setSaveState("saved");
    } catch {
      setError("Не удалось сохранить");
      setSaveState("error");
    }
  }, [activeHotelId, from]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persist(), 500);
  }, [persist]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [entries, scheduleSave]);

  function daySnapshot(dateKey: string) {
    const dayId = entries.find((e) => e.date === dateKey && e.role === "day_admin")?.staffId;
    const nightId = entries.find((e) => e.date === dateKey && e.role === "night_admin")?.staffId;
    const hkIds = entries.filter((e) => e.date === dateKey && e.role === "housekeeping").map((e) => e.staffId);
    return {
      dayAdmin: dayId ? hotelStaff.find((s) => s.id === dayId) : undefined,
      nightAdmin: nightId ? hotelStaff.find((s) => s.id === nightId) : undefined,
      housekeepers: hkIds.map((id) => hotelStaff.find((s) => s.id === id)).filter(Boolean) as StaffMember[],
    };
  }

  function setAdmin(date: string, role: ShiftRole, staffId: string) {
    setEntries((prev) => {
      const rest = prev.filter((e) => !(e.date === date && e.role === role));
      if (!staffId) return rest;
      return [...rest, { date, staffId, role }];
    });
  }

  function toggleHk(date: string, staffId: string) {
    setEntries((prev) => {
      const exists = prev.some((e) => e.date === date && e.staffId === staffId && e.role === "housekeeping");
      if (exists) {
        return prev.filter((e) => !(e.date === date && e.staffId === staffId && e.role === "housekeeping"));
      }
      return [...prev, { date, staffId, role: "housekeeping" }];
    });
  }

  function personShiftOnDay(personId: string, dateKey: string): ShiftRole | null {
    const hit = entries.find((e) => e.date === dateKey && e.staffId === personId);
    return hit?.role ?? null;
  }

  const todayCrew = useMemo(() => daySnapshot(todayKey), [entries, hotelStaff, todayKey]);
  const weekInRange = dayKeys.includes(todayKey);

  if (loading) {
    return (
      <>
        <TopBar title="График работы" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="График работы" subtitle={activeHotelId ? hotels.find((h) => h.id === activeHotelId)?.name : "Выберите отель"} />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {!activeHotelId && (
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-[13px] text-foreground">
            Выберите конкретный отель в переключателе слева для редактирования графика.
          </div>
        )}

        {activeHotelId && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekStartKey((k) => mskAddDays(k, -7))}
                  className="p-2 rounded-lg border border-border hover:bg-muted"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[14px] font-bold text-foreground min-w-[180px] text-center">
                  {fmtMskDateKey(from)} — {fmtMskDateKey(to)}
                </span>
                <button
                  onClick={() => setWeekStartKey((k) => mskAddDays(k, 7))}
                  className="p-2 rounded-lg border border-border hover:bg-muted"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setWeekStartKey(mondayOfMsk())}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-border text-primary hover:bg-accent"
                >
                  Текущая неделя
                </button>
              </div>
              <div className="flex items-center gap-3">
                <SaveIndicator state={saveState} />
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setView("days")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold ${view === "days" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  >
                    <LayoutGrid size={13} /> По дням
                  </button>
                  <button
                    onClick={() => setView("people")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold ${view === "people" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  >
                    <Users size={13} /> По людям
                  </button>
                </div>
              </div>
            </div>

            {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}

            {weekInRange && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-3">Сегодня на смене · {fmtMskDateKey(todayKey)}</p>
                <div className="flex flex-wrap gap-4">
                  <ShiftSlot label="Дневной админ" icon={<Sun size={14} />} role="day_admin" person={todayCrew.dayAdmin} />
                  <ShiftSlot label="Ночной админ" icon={<Moon size={14} />} role="night_admin" person={todayCrew.nightAdmin} />
                  <div className="min-w-[140px]">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase mb-1.5" style={{ color: SHIFT_ROLE_COLORS.housekeeping.text }}>
                      <Sparkles size={12} /> Горничные ({todayCrew.housekeepers.length})
                    </div>
                    {todayCrew.housekeepers.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {todayCrew.housekeepers.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: SHIFT_ROLE_COLORS.housekeeping.bg, color: SHIFT_ROLE_COLORS.housekeeping.text, border: `1px solid ${SHIFT_ROLE_COLORS.housekeeping.border}` }}>
                            <StaffAvatar person={p} size={18} />
                            {p.name.split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">Не назначены</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-[11px]">
              {(["day_admin", "night_admin", "housekeeping"] as ShiftRole[]).map((r) => {
                const c = SHIFT_ROLE_COLORS[r];
                return (
                  <span key={r} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                    {r === "day_admin" && <Sun size={11} />}
                    {r === "night_admin" && <Moon size={11} />}
                    {r === "housekeeping" && <Sparkles size={11} />}
                    {SHIFT_ROLE_LABELS[r]}
                  </span>
                );
              })}
            </div>

            {view === "days" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {dayKeys.map((dateKey, i) => {
                  const isToday = dateKey === todayKey;
                  const snap = daySnapshot(dateKey);
                  const dc = SHIFT_ROLE_COLORS.day_admin;
                  const nc = SHIFT_ROLE_COLORS.night_admin;
                  const hc = SHIFT_ROLE_COLORS.housekeeping;

                  return (
                    <div
                      key={dateKey}
                      className={`rounded-xl border bg-card flex flex-col min-h-[260px] ${isToday ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border"}`}
                    >
                      <div className={`px-3 py-2.5 border-b text-center ${isToday ? "bg-primary/10 border-primary/20" : "bg-muted/50 border-border"}`}>
                        <div className={`text-[13px] font-black ${isToday ? "text-primary" : "text-foreground"}`}>{DAY_LABELS[i]}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtMskDateKey(dateKey, true)}</div>
                        {isToday && <div className="text-[9px] font-bold text-primary mt-0.5">СЕГОДНЯ</div>}
                      </div>

                      <div className="p-3 space-y-3 flex-1">
                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1.5" style={{ color: dc.text }}>
                            <Sun size={11} /> День
                          </div>
                          <ShiftStaffPicker
                            role="day_admin"
                            staff={snap.dayAdmin}
                            candidates={admins}
                            onSelect={(id) => setAdmin(dateKey, "day_admin", id)}
                            onClear={() => setAdmin(dateKey, "day_admin", "")}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1.5" style={{ color: nc.text }}>
                            <Moon size={11} /> Ночь
                          </div>
                          <ShiftStaffPicker
                            role="night_admin"
                            staff={snap.nightAdmin}
                            candidates={admins}
                            onSelect={(id) => setAdmin(dateKey, "night_admin", id)}
                            onClear={() => setAdmin(dateKey, "night_admin", "")}
                          />
                        </div>

                        <div className="pt-1 border-t border-border/60">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1.5" style={{ color: hc.text }}>
                            <Sparkles size={11} /> Уборка
                            <span className="font-normal normal-case text-muted-foreground">· можно несколько</span>
                          </div>
                          <div className="space-y-1">
                            {housekeepers.map((hk) => {
                              const on = snap.housekeepers.some((h) => h.id === hk.id);
                              return (
                                <ShiftStaffChip
                                  key={hk.id}
                                  person={hk}
                                  role="housekeeping"
                                  selected={on}
                                  onClick={() => toggleHk(dateKey, hk.id)}
                                />
                              );
                            })}
                            {housekeepers.length === 0 && (
                              <p className="text-[10px] text-muted-foreground">Нет горничных</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "people" && (
              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase w-48 sticky left-0 bg-muted/60 z-10">Сотрудник</th>
                      {dayKeys.map((dateKey, i) => {
                        const isToday = dateKey === todayKey;
                        return (
                          <th key={dateKey} className={`px-1 py-3 text-center min-w-[88px] ${isToday ? "bg-primary/10" : ""}`}>
                            <div className={`text-[11px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{DAY_LABELS[i]}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">{fmtMskDateKey(dateKey, true).slice(0, 5)}</div>
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 text-center text-[10px] font-bold text-muted-foreground w-14">Смен</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotelStaff.length > 0 && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={9} className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase">Команда отеля</td>
                      </tr>
                    )}
                    {hotelStaff.map((person) => {
                      const shiftCount = entries.filter((e) => e.staffId === person.id).length;
                      const isAdmin = person.role === "admin" || person.role === "manager";
                      return (
                        <tr key={person.id} className="border-b border-border/50 hover:bg-muted/15">
                          <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                              <StaffAvatar person={person} />
                              <div>
                                <div className="text-[12px] font-bold text-foreground leading-tight">{person.name}</div>
                                <div className="text-[10px] text-muted-foreground">{person.position || person.role}</div>
                              </div>
                            </div>
                          </td>
                          {dayKeys.map((dateKey) => {
                            const isToday = dateKey === todayKey;
                            const shift = personShiftOnDay(person.id, dateKey);
                            return (
                              <td key={dateKey} className={`px-1 py-2 text-center align-middle ${isToday ? "bg-primary/5" : ""}`}>
                                {isAdmin ? (
                                  <AdminDayCell
                                    shift={shift === "day_admin" || shift === "night_admin" ? shift : null}
                                    onPick={(next) => {
                                      if (shift === "day_admin") {
                                        setAdmin(dateKey, "day_admin", "");
                                        if (next === "night_admin") setAdmin(dateKey, "night_admin", person.id);
                                      } else if (shift === "night_admin") {
                                        setAdmin(dateKey, "night_admin", "");
                                      } else if (next === "day_admin") {
                                        setAdmin(dateKey, "day_admin", person.id);
                                      }
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => toggleHk(dateKey, person.id)}
                                    className="w-full min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all px-1"
                                    style={{
                                      background: shift === "housekeeping" ? SHIFT_ROLE_COLORS.housekeeping.bg : undefined,
                                      border: `2px solid ${shift === "housekeeping" ? SHIFT_ROLE_COLORS.housekeeping.text : "hsl(var(--border))"}`,
                                      opacity: shift === "housekeeping" ? 1 : 0.35,
                                    }}
                                  >
                                    {shift === "housekeeping" ? (
                                      <>
                                        <Sparkles size={14} style={{ color: SHIFT_ROLE_COLORS.housekeeping.text }} />
                                        <span className="text-[9px] font-bold" style={{ color: SHIFT_ROLE_COLORS.housekeeping.text }}>Уборка</span>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">—</span>
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-2">
                            <span className="text-[13px] font-black text-primary">{shiftCount}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {hotelStaff.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-[12px] text-muted-foreground">Нет сотрудников у этого отеля</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Изменения сохраняются автоматически. Вид «По дням» — кто дежурит в каждый день. Вид «По людям» — личный график.
              {canManageSettings && " Ставки — в Настройки → Финансы → Зарплата и премии."}
            </p>
          </>
        )}
      </div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Сохранение…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
        <Check size={13} /> Сохранено
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-[11px] font-semibold text-destructive">Ошибка сохранения</span>;
  }
  return null;
}

function ShiftSlot({
  label, icon, role, person,
}: {
  label: string;
  icon: React.ReactNode;
  role: ShiftRole;
  person?: StaffMember;
}) {
  const c = SHIFT_ROLE_COLORS[role];
  return (
    <div className="min-w-[130px]">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase mb-1.5" style={{ color: c.text }}>
        {icon} {label}
      </div>
      {person ? (
        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-semibold text-[12px]" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          <StaffAvatar person={person} size={24} />
          {person.name}
        </div>
      ) : (
        <span className="text-[12px] text-muted-foreground italic">Не назначен</span>
      )}
    </div>
  );
}

function AdminDayCell({
  shift,
  onPick,
}: {
  shift: "day_admin" | "night_admin" | null;
  onPick: (next: "day_admin" | "night_admin" | null) => void;
}) {
  if (shift === "day_admin") {
    const c = SHIFT_ROLE_COLORS.day_admin;
    return (
      <button type="button" onClick={() => onPick("night_admin")} className="w-full min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-0.5 px-1" style={{ background: c.bg, border: `2px solid ${c.text}` }}>
        <Sun size={16} style={{ color: c.text }} />
        <span className="text-[10px] font-black" style={{ color: c.text }}>День</span>
      </button>
    );
  }
  if (shift === "night_admin") {
    const c = SHIFT_ROLE_COLORS.night_admin;
    return (
      <button type="button" onClick={() => onPick(null)} className="w-full min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-0.5 px-1" style={{ background: c.bg, border: `2px solid ${c.text}` }}>
        <Moon size={16} style={{ color: c.text }} />
        <span className="text-[10px] font-black" style={{ color: c.text }}>Ночь</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPick("day_admin")}
      className="w-full min-h-[52px] rounded-lg border-2 border-dashed border-border text-[10px] text-muted-foreground hover:bg-muted/50 hover:border-primary/40"
    >
      + смена
    </button>
  );
}
