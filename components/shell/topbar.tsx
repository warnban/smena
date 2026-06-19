"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, X } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { HamsterModeToggle } from "@/components/hamster/hamster-mode-toggle";
import { BOOKING_ST } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

interface SearchResult {
  guests: { id: string; name: string; phone: string; isForeigner: boolean }[];
  bookings: { id: string; guestName: string; status: string; checkIn: string; checkOut: string }[];
  rooms: { id: string; number: string; category: string; status: string; hotelId: string }[];
}

export function TopBar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const data = await res.json();
    setResults(data);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hasResults = results && (results.guests.length + results.bookings.length + results.rooms.length > 0);

  const searchField = (
    <div className="relative w-full sm:w-44" ref={wrapRef}>
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setOpen(true)}
        placeholder="Поиск..."
        className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground placeholder:text-muted-foreground/60"
      />
      {open && (
        <div className="absolute right-0 left-0 sm:left-auto sm:w-72 top-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto custom-scrollbar">
          {!hasResults && <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">Ничего не найдено</div>}
          {results?.guests.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { router.push("/guests"); setOpen(false); setQuery(""); setMobileSearch(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/40"
            >
              <div className="text-[12px] font-bold text-foreground">{g.name}</div>
              <div className="text-[10px] text-muted-foreground">Гость · {g.phone || "—"}</div>
            </button>
          ))}
          {results?.bookings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { router.push("/bookings"); setOpen(false); setQuery(""); setMobileSearch(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/40"
            >
              <div className="text-[12px] font-bold text-foreground">{b.guestName}</div>
              <div className="text-[10px] text-muted-foreground">
                Бронь · {BOOKING_ST[b.status]?.label ?? b.status} · {fmtDate(new Date(b.checkIn), true)}
              </div>
            </button>
          ))}
          {results?.rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { router.push("/rooms"); setOpen(false); setQuery(""); setMobileSearch(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/40 last:border-0"
            >
              <div className="text-[12px] font-bold text-foreground">№{r.number}</div>
              <div className="text-[10px] text-muted-foreground">Номер · {r.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-card px-4 md:px-6 py-3 flex-shrink-0 border-b border-border sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {children}
          <button
            type="button"
            onClick={() => setMobileSearch((v) => !v)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            aria-label="Поиск"
          >
            {mobileSearch ? <X size={16} /> : <Search size={16} />}
          </button>
          <div className="hidden md:block">{searchField}</div>
          <HamsterModeToggle />
          <ThemeToggle />
          <button type="button" className="relative p-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors hidden sm:flex">
            <Bell size={15} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-destructive rounded-full" />
          </button>
        </div>
      </div>
      {mobileSearch && <div className="mt-2 md:hidden">{searchField}</div>}
    </div>
  );
}
