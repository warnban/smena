"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRuDate, formatRuDateInput, parseRuDate, ruDateToIso } from "@/lib/validation/date";

type DatePickerProps = {
  value: string;
  onChange: (v: string) => void;
  mode?: "iso" | "ru";
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
  /** Поле ввода + кнопка календаря (для ДД.ММ.ГГГГ) */
  allowInput?: boolean;
  onBlur?: () => void;
};

const PANEL_W = 288;
const PANEL_H = 340;
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDate(value: string, mode: "iso" | "ru"): Date | null {
  if (!value) return null;
  if (mode === "iso") {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseRuDate(value);
}

function fromDate(d: Date, mode: "iso" | "ru"): string {
  return mode === "iso" ? format(d, "yyyy-MM-dd") : formatRuDate(d);
}

function displayValue(value: string, mode: "iso" | "ru"): string {
  if (!value) return "";
  if (mode === "iso") {
    const d = toDate(value, "iso");
    return d ? format(d, "d MMM yyyy", { locale: ru }) : value;
  }
  return value;
}

type PanelPos = { top: number; left: number };

function CalendarPanel({
  viewMonth,
  setViewMonth,
  selected,
  onPick,
  onClear,
  onToday,
  isDisabled,
  showClear,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  selected: Date | null;
  onPick: (d: Date) => void;
  onClear: () => void;
  onToday: () => void;
  isDisabled: (d: Date) => boolean;
  showClear: boolean;
}) {
  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const all = eachDayOfInterval({ start, end });
    const pad = (getDay(start) + 6) % 7;
    return { pad, all };
  }, [viewMonth]);

  return (
    <div className="p-3 rounded-xl border border-border bg-card shadow-xl shadow-black/15 min-w-[280px] animate-fade-in animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-bold text-foreground capitalize">
          {format(viewMonth, "LLLL yyyy", { locale: ru })}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: days.pad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.all.map((d) => {
          const sel = selected && isSameDay(d, selected);
          const today = isToday(d);
          const disabled = isDisabled(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              className={`
                h-8 w-8 mx-auto rounded-lg text-[12px] font-semibold transition-all
                ${disabled ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-primary/10 hover:text-primary cursor-pointer"}
                ${sel ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm" : ""}
                ${today && !sel ? "ring-1 ring-primary/50 text-primary" : ""}
                ${!sel && !today && !disabled ? "text-foreground" : ""}
              `}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <button type="button" onClick={onToday} className="text-[11px] font-bold text-primary hover:underline">
          Сегодня
        </button>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Очистить
          </button>
        )}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  mode = "iso",
  placeholder = "Выберите дату",
  className = "",
  min,
  max,
  allowInput = false,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos>({ top: 0, left: 0 });
  const [inputText, setInputText] = useState(value);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = toDate(value, mode);
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());

  const minDate = min ? toDate(min, mode) : null;
  const maxDate = max ? toDate(max, mode) : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  useEffect(() => {
    const parsed = toDate(value, mode);
    if (parsed) setViewMonth(parsed);
  }, [value, mode]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_H + 12 && rect.top > PANEL_H + 12;
    const top = openUp ? rect.top - PANEL_H - 6 : rect.bottom + 6;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_W - 8));
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function isDisabled(d: Date): boolean {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (minDate) {
      const minD = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (day < minD) return true;
    }
    if (maxDate) {
      const maxD = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      if (day > maxD) return true;
    }
    return false;
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    onChange(fromDate(d, mode));
    setOpen(false);
  }

  function clear() {
    onChange("");
    setInputText("");
    setOpen(false);
  }

  function handleInputChange(raw: string) {
    const formatted = mode === "ru" ? formatRuDateInput(raw) : raw;
    setInputText(formatted);
    onChange(formatted);
  }

  const panel = open && mounted ? (
    createPortal(
      <div
        ref={panelRef}
        style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CalendarPanel
          viewMonth={viewMonth}
          setViewMonth={setViewMonth}
          selected={selected}
          onPick={pick}
          onClear={clear}
          onToday={() => pick(new Date())}
          isDisabled={isDisabled}
          showClear={Boolean(value)}
        />
      </div>,
      document.body
    )
  ) : null;

  if (allowInput && mode === "ru") {
    return (
      <div ref={triggerRef} className={`relative flex gap-1.5 ${className}`}>
        <input
          type="text"
          inputMode="numeric"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex-shrink-0 p-1.5 rounded-lg border transition-colors outline-none focus:ring-1 focus:ring-ring ${
            open ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
          aria-label="Открыть календарь"
        >
          <Calendar size={16} />
        </button>
        {panel}
      </div>
    );
  }

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] rounded-lg border text-left transition-colors outline-none focus:ring-1 focus:ring-ring ${
          open ? "border-primary bg-primary/5" : "border-border bg-muted hover:border-primary/40"
        }`}
      >
        <Calendar size={14} className={`flex-shrink-0 ${value ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`flex-1 truncate ${value ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {value ? displayValue(value, mode) : placeholder}
        </span>
      </button>
      {panel}
    </div>
  );
}

export { ruDateToIso };
