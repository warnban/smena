"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Globe, AlertTriangle } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { money, dayDiff } from "@/lib/format";
import { DORM_GENDER_LABELS } from "@/lib/constants";
import { formatBookingPlaceOptionLabel, guestGenderMatchesDorm } from "@/lib/dorm";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput, getPhoneError } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import type { BookingSource, Guest } from "@/lib/types";

interface Props {
  onClose: () => void;
  onCreated?: (bookingId: string) => void;
}

type AvailSlot = {
  id: string;
  roomId: string;
  bedId: string | null;
  kind: "private" | "dorm";
  roomLabel: string;
  number: string;
  bedLabel: string | null;
  category: string;
  floor: number;
  price: number;
  dormGender: "male" | "female" | "mixed" | null;
  placeStatus?: "available" | "occupied" | "cleaning" | "checkout" | "maintenance";
};

export function NewBookingModal({ onClose, onCreated }: Props) {
  const { hotels, rooms, guests, hotelId, refresh, getCategoryLabel, sourceConfig } = useApp();

  const activeHotel = hotelId !== "all" ? hotels.find((h) => h.id === hotelId) : null;
  const activeHotelId = activeHotel?.id ?? "";

  const [placeId, setPlaceId] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isForeigner, setIsForeigner] = useState(false);
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [source, setSource] = useState<BookingSource>(
    () => (sourceConfig.direct ? "direct" : Object.keys(sourceConfig)[0] ?? "direct")
  );
  const [guestsCount, setGuestsCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [availSlots, setAvailSlots] = useState<AvailSlot[]>([]);
  const [availLoading, setAvailLoading] = useState(false);

  const guestMatches = useMemo(() => {
    const q = guestName.toLowerCase().trim();
    if (q.length < 2) return [];
    return guests
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.phone.includes(q) ||
          g.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [guests, guestName]);

  const selectedGuest = guests.find((g) => g.id === selectedGuestId);
  const showGuestSuggestions = guestName.trim().length >= 2 && !selectedGuestId && guestMatches.length > 0;

  const selectedSlot = availSlots.find((s) => s.id === placeId);
  const selectedRoom = selectedSlot ? rooms.find((r) => r.id === selectedSlot.roomId) : undefined;
  const isDorm = selectedSlot?.kind === "dorm";

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return Math.max(1, dayDiff(new Date(checkIn), new Date(checkOut)));
  }, [checkIn, checkOut]);

  const genderMismatch = Boolean(
    isDorm &&
    selectedRoom?.dormGender &&
    selectedRoom.dormGender !== "mixed" &&
    selectedGuest &&
    !guestGenderMatchesDorm(selectedGuest.gender, selectedRoom.dormGender)
  );

  const placeOptions = useMemo(() => {
    const sorted = [...availSlots].sort((a, b) => {
      const floorDiff = (a.floor ?? 0) - (b.floor ?? 0);
      if (floorDiff !== 0) return floorDiff;
      if (a.kind !== b.kind) return a.kind === "private" ? -1 : 1;
      return a.number.localeCompare(b.number, "ru", { numeric: true });
    });

    return sorted.map((s) => ({
      value: s.id,
      label: formatBookingPlaceOptionLabel({
        kind: s.kind,
        roomLabel: s.roomLabel,
        number: s.number,
        bedLabel: s.bedLabel,
        category: getCategoryLabel(s.category),
        price: s.price,
        money,
        placeStatus: s.placeStatus,
      }),
    }));
  }, [availSlots, getCategoryLabel]);

  useEffect(() => {
    if (!activeHotelId || !checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      setAvailSlots([]);
      return;
    }
    const params = new URLSearchParams({
      hotelId: activeHotelId,
      checkIn,
      checkOut,
    });
    if (selectedGuestId) params.set("guestId", selectedGuestId);

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
  }, [activeHotelId, checkIn, checkOut, selectedGuestId]);

  useEffect(() => {
    if (placeId && !availSlots.some((s) => s.id === placeId)) {
      setPlaceId("");
    }
  }, [availSlots, placeId]);

  const calcAmount = selectedSlot ? selectedSlot.price * nights : 0;
  const amount = calcAmount;

  function pickGuest(g: Guest) {
    setSelectedGuestId(g.id);
    setGuestName(g.name);
    setPhone(g.phone);
    setEmail(g.email);
    setIsForeigner(g.isForeigner);
    setPlaceId("");
  }

  function onGuestNameChange(value: string) {
    setGuestName(value);
    if (selectedGuestId) {
      const current = guests.find((g) => g.id === selectedGuestId);
      if (!current || value.trim() !== current.name) {
        setSelectedGuestId("");
        setPlaceId("");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!activeHotelId) {
      setError("Выберите конкретный отель в переключателе слева");
      return;
    }
    if (!selectedSlot) {
      setError("Выберите номер или койко-место");
      return;
    }
    if (genderMismatch) {
      setError(
        selectedRoom?.dormGender === "male"
          ? "Мужская комната — нельзя заселить женщину"
          : "Женская комната — нельзя заселить мужчину"
      );
      return;
    }
    if (!guestName.trim() && !selectedGuestId) {
      setError("Укажите ФИО гостя");
      return;
    }
    const phoneErr = getPhoneError(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (checkIn && checkOut && new Date(checkOut) <= new Date(checkIn)) {
      setError("Дата выезда должна быть позже даты заезда");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: activeHotelId,
          roomId: selectedSlot.roomId,
          bedId: selectedSlot.bedId ?? undefined,
          guestId: selectedGuestId || undefined,
          guestName: guestName.trim() || selectedGuest?.name,
          phone,
          email,
          isForeigner: selectedGuestId ? undefined : isForeigner,
          checkIn,
          checkOut,
          source,
          guests: guestsCount,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать бронь");
        return;
      }
      await refresh();
      onCreated?.(data.booking.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-[15px] font-black text-foreground">Новое бронирование</h2>
            <p className="text-[11px] text-muted-foreground">
              {activeHotel ? `${activeHotel.name} · ${activeHotel.city}` : "Выберите отель в переключателе"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {!activeHotel && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-[12px] bg-warning/10 border border-warning/30 text-foreground">
              <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
              <span>Для создания брони выберите конкретную гостиницу в переключателе отелей (не «Все отели»).</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">ФИО гостя</label>
            <input
              value={guestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {showGuestSuggestions && (
              <div className="mt-1 border border-border rounded-xl overflow-hidden bg-card shadow-lg">
                {guestMatches.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGuest(g)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/40 last:border-0"
                  >
                    <div className="text-[13px] font-bold text-foreground">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {g.phone || "—"} · {g.visits} визит(ов)
                      {g.gender === "M" ? " · муж." : g.gender === "F" ? " · жен." : ""}
                      {g.isForeigner ? " · иностранец" : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedGuest && (
              <div className="mt-2 p-3 rounded-xl bg-muted/60 border border-border text-[12px]">
                <span className="font-bold text-foreground">{selectedGuest.name}</span>
                <span className="text-muted-foreground ml-2">из базы</span>
                <span className="text-muted-foreground ml-2">
                  {selectedGuest.gender === "M" ? "муж." : "жен."}
                </span>
                {selectedGuest.isForeigner && <span className="ml-2 text-[#D97706] font-semibold">иностранец</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Заезд</label>
              <DatePicker value={checkIn} onChange={setCheckIn} mode="iso" placeholder="Дата заезда" className="[&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Выезд</label>
              <DatePicker value={checkOut} onChange={setCheckOut} mode="iso" placeholder="Дата выезда" min={checkIn || undefined} className="[&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">
              Номер / койко-место
              {availLoading && <span className="font-normal text-muted-foreground ml-1">· проверка…</span>}
            </label>
            {genderMismatch ? (
              <div className="flex items-start gap-2 p-3 rounded-xl text-[12px] bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  {selectedRoom?.dormGender === "male"
                    ? "Мужская комната — выберите другое место для этого гостя"
                    : "Женская комната — выберите другое место для этого гостя"}
                </span>
              </div>
            ) : placeOptions.length === 0 && !availLoading ? (
              <p className="text-[12px] text-muted-foreground px-1">Нет свободных мест на выбранные даты</p>
            ) : (
              <Select
                value={placeId}
                onChange={setPlaceId}
                disabled={!activeHotel || availLoading}
                placeholder="Выберите номер или койко-место"
                options={placeOptions}
              />
            )}
            {isDorm && selectedRoom?.dormGender && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {DORM_GENDER_LABELS[selectedRoom.dormGender]} общая комната
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Телефон</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className="[&_input]:px-3 [&_input]:py-2 [&_input]:text-[13px] [&_input]:rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          {!selectedGuestId && (
            <>
              <label className={`flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-colors ${isForeigner ? "border-[#FDE68A] bg-[#FFFBEB]" : "border-border bg-muted/50"}`}>
                <input type="checkbox" checked={isForeigner} onChange={(e) => setIsForeigner(e.target.checked)} className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                    <Globe size={14} className="text-[#D97706]" />
                    Иностранный гражданин
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Включит миграционный учёт. Документы — при заселении.</p>
                </div>
              </label>
              {isForeigner && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
                  <span className="text-[#991B1B]">Уведомление в МВД — в течение 2 рабочих дней. Отметку можно поставить в профиле гостя.</span>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Источник</label>
              <Select
                value={source}
                onChange={(v) => setSource(v as BookingSource)}
                options={Object.entries(sourceConfig).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Гостей</label>
              <input type="number" min={1} value={guestsCount} onChange={(e) => setGuestsCount(Number(e.target.value) || 1)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Ночей</label>
              <div className="px-3 py-2 text-[13px] font-bold text-foreground bg-muted rounded-xl border border-border">{nights}</div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Примечания</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </form>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="text-[13px]">
            <span className="text-muted-foreground">Итого: </span>
            <span className="font-black text-foreground">{money(amount)}</span>
            {isDorm && selectedSlot && (
              <span className="text-[11px] text-muted-foreground ml-1">({money(selectedSlot.price)}/койка)</span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">Отмена</button>
            <button type="submit" disabled={busy || !activeHotel || genderMismatch} onClick={submit} className="px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
              {busy ? "Создание…" : "Создать бронь"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
