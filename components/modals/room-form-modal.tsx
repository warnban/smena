"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { ROOM_STATUS, DORM_GENDER_LABELS, ROOM_KIND_LABELS } from "@/lib/constants";
import { findDuplicateBedNumbers, normalizeBedNumbers } from "@/lib/bed-numbers";
import type { DormGender, Room, RoomKind, RoomStatus } from "@/lib/types";
import { Select } from "@/components/ui/select";

interface Props {
  room?: Room | null;
  defaultHotelId?: string;
  onClose: () => void;
}

function emptyBedRow() {
  return { id: crypto.randomUUID(), value: "" };
}

export function RoomFormModal({ room, defaultHotelId, onClose }: Props) {
  const { hotels, hotelId, beds, refresh, canManageSettings, session, roomCategories } = useApp();
  const isEdit = Boolean(room);
  const canWrite = session?.role === "owner" || session?.role === "manager" || session?.role === "admin";

  const [formHotelId, setFormHotelId] = useState(room?.hotelId ?? (hotelId === "all" ? defaultHotelId ?? hotels[0]?.id ?? "" : hotelId));
  const [number, setNumber] = useState(room?.number ?? "");
  const activeCats = roomCategories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaultCat = activeCats[0]?.code ?? "Double";

  const [kind, setKind] = useState<RoomKind>(room?.kind ?? "private");
  const [dormGender, setDormGender] = useState<DormGender>(room?.dormGender ?? "mixed");
  const [bedRows, setBedRows] = useState(() => [emptyBedRow(), emptyBedRow(), emptyBedRow(), emptyBedRow()]);
  const [addBedRows, setAddBedRows] = useState(() => [emptyBedRow()]);
  const [category, setCategory] = useState(room?.category ?? defaultCat);
  const [floor, setFloor] = useState(String(room?.floor ?? 1));
  const [status, setStatus] = useState<RoomStatus>(room?.status ?? "available");
  const [price, setPrice] = useState(String(room?.price ?? 0));
  const [amenitiesText, setAmenitiesText] = useState((room?.amenities ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roomBeds = useMemo(
    () => (room ? beds.filter((b) => b.roomId === room.id).sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true })) : []),
    [beds, room]
  );

  if (!canWrite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-muted-foreground">Недостаточно прав для редактирования номеров</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-sm font-bold rounded-xl border border-border">Закрыть</button>
        </div>
      </div>
    );
  }

  function collectBedNumbers(rows: { value: string }[]): string[] {
    return normalizeBedNumbers(rows.map((r) => r.value));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!formHotelId || !number.trim()) {
      setError("Укажите отель и название");
      return;
    }

    let bedNumbers: string[] = [];
    if (kind === "dorm") {
      if (!isEdit) {
        bedNumbers = collectBedNumbers(bedRows);
        if (!bedNumbers.length) {
          setError("Укажите номер хотя бы одной койки");
          return;
        }
        const dup = findDuplicateBedNumbers(bedNumbers);
        if (dup) {
          setError(`Номер «${dup}» указан дважды`);
          return;
        }
      } else {
        bedNumbers = collectBedNumbers(addBedRows);
        if (bedNumbers.length) {
          const dup = findDuplicateBedNumbers(bedNumbers);
          if (dup) {
            setError(`Номер «${dup}» указан дважды`);
            return;
          }
        }
      }
    }

    setBusy(true);
    try {
      const amenities = amenitiesText.split(",").map((s) => s.trim()).filter(Boolean);
      const payload: Record<string, unknown> = {
        hotelId: formHotelId,
        number: number.trim(),
        kind,
        category,
        floor: Number(floor) || 1,
        status,
        price: Number(price) || 0,
        amenities,
      };
      if (kind === "dorm") {
        payload.dormGender = dormGender;
        if (!isEdit) payload.bedNumbers = bedNumbers;
        else if (bedNumbers.length) payload.addBedNumbers = bedNumbers;
      }
      const res = await fetch(isEdit ? `/api/rooms/${room!.id}` : "/api/rooms", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!room || !confirm(`Удалить ${room.kind === "dorm" ? "общую комнату" : "номер"} №${room.number}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось удалить");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function renderBedInputs(
    rows: { id: string; value: string }[],
    setRows: React.Dispatch<React.SetStateAction<{ id: string; value: string }[]>>,
    label: string
  ) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-muted-foreground">{label}</label>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyBedRow()])}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:opacity-80"
          >
            <Plus size={12} /> Добавить
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Каждая койка — свой уникальный номер по всему отелю (не 301/1, а например 101, 102…)</p>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex gap-2">
              <input
                value={row.value}
                onChange={(e) =>
                  setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))
                }
                placeholder={`Номер койки ${idx + 1}`}
                className="flex-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-[15px] font-black text-foreground">
            {isEdit ? `${ROOM_KIND_LABELS[room!.kind] ?? "Номер"} ${room!.kind === "dorm" ? room!.number : `№${room!.number}`}` : "Новый объект"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Отель</label>
            <Select
              value={formHotelId}
              onChange={setFormHotelId}
              disabled={isEdit}
              options={hotels.map((h) => ({ value: h.id, label: h.name }))}
            />
          </div>

          {!isEdit && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Тип</label>
              <Select
                value={kind}
                onChange={(v) => setKind(v as RoomKind)}
                options={[
                  { value: "private", label: ROOM_KIND_LABELS.private! },
                  { value: "dorm", label: ROOM_KIND_LABELS.dorm! },
                ]}
              />
            </div>
          )}

          {kind === "dorm" && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Тип комнаты</label>
              <Select
                value={dormGender}
                onChange={(v) => setDormGender(v as DormGender)}
                options={[
                  { value: "male", label: DORM_GENDER_LABELS.male! },
                  { value: "female", label: DORM_GENDER_LABELS.female! },
                  { value: "mixed", label: DORM_GENDER_LABELS.mixed! },
                ]}
              />
            </div>
          )}

          {kind === "dorm" && !isEdit && renderBedInputs(bedRows, setBedRows, "Номера коек")}
          {kind === "dorm" && isEdit && renderBedInputs(addBedRows, setAddBedRows, "Добавить койки")}

          {isEdit && room?.kind === "dorm" && roomBeds.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-bold text-muted-foreground mb-2">Койки в комнате ({roomBeds.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {roomBeds.map((b) => (
                  <span key={b.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-card border border-border">
                    №{b.label} · {ROOM_STATUS[b.status]?.label ?? b.status}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">{kind === "dorm" ? "Название комнаты" : "Номер"}</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={kind === "dorm" ? "301" : "101"} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Этаж</label>
              <input type="number" min={1} value={floor} onChange={(e) => setFloor(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Категория</label>
              <Select
                value={category}
                onChange={setCategory}
                options={activeCats.map((c) => ({ value: c.code, label: c.label }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Статус</label>
              <Select
                value={status}
                onChange={(v) => setStatus(v as RoomStatus)}
                options={Object.entries(ROOM_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">
              {kind === "dorm" ? "Цена за койку/сутки (₽)" : "Цена за сутки (₽)"}
            </label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Удобства (через запятую)</label>
            <input value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} placeholder="Wi-Fi, ТВ, Мини-бар" className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
          <div className="flex gap-2 pt-1">
            {isEdit && canManageSettings && (
              <button type="button" onClick={remove} disabled={busy} className="px-3 py-2 text-[12px] font-bold rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50">
                Удалить
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">Отмена</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
              {busy ? "Сохранение…" : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
