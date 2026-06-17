"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";

export type CreatableSelectOption = {
  value: string;
  label: string;
};

type CreatableSelectProps = {
  value: string;
  onChange: (value: string, label: string) => void;
  options: CreatableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  createLabel?: (query: string) => string;
};

export function CreatableSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите или введите…",
  disabled = false,
  className = "",
  label,
  createLabel = (q) => `Создать «${q}»`,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return options.some((o) => o.label.toLowerCase() === q || o.value.toLowerCase() === q);
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function pick(opt: CreatableSelectOption) {
    onChange(opt.value, opt.label);
    close();
  }

  function createNew() {
    const labelText = query.trim();
    if (!labelText) return;
    onChange(labelText, labelText);
    close();
  }

  const panel = open && mounted && rootRef.current ? (
    createPortal(
      (() => {
        const rect = rootRef.current!.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUp = spaceBelow < 260 && rect.top > spaceBelow;
        const maxH = Math.min(320, openUp ? rect.top - 8 : spaceBelow - 8);
        const style: React.CSSProperties = {
          position: "fixed",
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
          maxHeight: maxH,
          ...(openUp
            ? { bottom: window.innerHeight - rect.top + 4 }
            : { top: rect.bottom + 4 }),
        };
        return (
          <div
            ref={panelRef}
            id={listId}
            className="rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden flex flex-col animate-fade-in"
            style={style}
          >
            <div className="p-2 border-b border-border flex-shrink-0">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск или новая категория…"
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
              {filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => pick(opt)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left transition-colors ${
                      active ? "bg-accent text-primary font-semibold" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    {active && <Check size={14} className="flex-shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && !query.trim() && (
                <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">Нет категорий</div>
              )}
              {query.trim() && !exactMatch && (
                <button
                  type="button"
                  onClick={createNew}
                  className="w-full flex items-center gap-2 px-3 py-3 text-[13px] font-bold text-primary hover:bg-accent border-t border-border"
                >
                  <Plus size={14} />
                  {createLabel(query.trim())}
                </button>
              )}
            </div>
          </div>
        );
      })(),
      document.body
    )
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-muted-foreground block mb-1">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted text-left outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <span className={`flex-1 truncate ${selected || value ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {selected?.label ?? (value || placeholder)}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {panel}
    </div>
  );
}
