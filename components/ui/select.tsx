"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { Icon } from "@/components/icon";

export type SelectOption = {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  bg?: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  size?: "sm" | "md";
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "Выберите…",
  disabled = false,
  className = "",
  label,
  size = "md",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
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

  const py = size === "sm" ? "py-1.5" : "py-2.5";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";

  const panel = open && mounted && rootRef.current ? (
    createPortal(
      (() => {
        const rect = rootRef.current!.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUp = spaceBelow < 220 && rect.top > spaceBelow;
        const maxH = Math.min(280, openUp ? rect.top - 8 : spaceBelow - 8);
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
            role="listbox"
            className="rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-y-auto custom-scrollbar animate-fade-in"
            style={style}
          >
            {options.length === 0 ? (
              <div className={`px-3 ${py} ${text} text-muted-foreground`}>Нет вариантов</div>
            ) : (
              options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      close();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 ${py} ${text} text-left transition-colors disabled:opacity-40 ${
                      active ? "bg-accent text-primary font-semibold" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {opt.icon && (
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: opt.bg ?? "#F1F5F9" }}
                      >
                        <Icon name={opt.icon} size={14} style={{ color: opt.color ?? "#64748B" }} />
                      </span>
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {active && <Check size={14} className="flex-shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
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
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 ${py} ${text} rounded-xl border border-border bg-muted text-left outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors`}
      >
        {selected?.icon && (
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: selected.bg ?? "#F1F5F9" }}
          >
            <Icon name={selected.icon} size={12} style={{ color: selected.color ?? "#64748B" }} />
          </span>
        )}
        <span className={`flex-1 truncate ${selected ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {panel}
    </div>
  );
}
