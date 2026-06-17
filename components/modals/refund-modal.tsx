"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Search, RotateCcw, Check } from "lucide-react";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate } from "@/lib/format";

type RefundCandidate = {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  paid: number;
  prepaidNights: number;
  consumedNights: number;
  refundableNights: number;
  maxRefundAmount: number;
};

type RefundQuote = {
  refundAmount: number;
  maxRefundNights: number;
  recalcNote: string;
  obligationAmount: number;
  withholdAmount: number;
  clawbackAmount: number;
};

export function RefundModal({ onClose }: { onClose: () => void }) {
  const { hotelId, hotels, pmConfig, refresh } = useApp();
  const activeHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<RefundCandidate[]>([]);
  const [selected, setSelected] = useState<RefundCandidate | null>(null);
  const [nights, setNights] = useState(1);
  const [withholdNights, setWithholdNights] = useState(0);
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const pmEntries = Object.entries(pmConfig);
  const maxNights = selected
    ? Math.max(0, selected.refundableNights - (withholdNights > 0 ? 0 : 0))
    : 0;

  const loadQuote = useCallback(async () => {
    if (!selected || !activeHotelId || nights <= 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const params = new URLSearchParams({
        hotelId: activeHotelId,
        bookingId: selected.id,
        nights: String(nights),
        withholdNights: String(withholdNights),
      });
      const res = await fetch(`/api/refunds/quote?${params}`);
      const data = await res.json();
      if (res.ok) setQuote(data.quote);
      else setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [selected, activeHotelId, nights, withholdNights]);

  useEffect(() => {
    const t = setTimeout(loadQuote, 200);
    return () => clearTimeout(t);
  }, [loadQuote]);

  const refundAmount = quote?.refundAmount ?? 0;

  const search = useCallback(async (q: string) => {
    if (!activeHotelId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ hotelId: activeHotelId });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/refunds/search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось найти гостей");
        setCandidates([]);
        return;
      }
      setCandidates(data.bookings ?? []);
    } finally {
      setLoading(false);
    }
  }, [activeHotelId]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (selected) {
      setNights(1);
      setWithholdNights(0);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const max = Math.max(0, (quote?.maxRefundNights ?? selected.refundableNights));
    if (nights > max) setNights(Math.max(1, max));
  }, [withholdNights, quote, selected, nights]);

  async function submit() {
    if (!selected || !activeHotelId || nights <= 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: activeHotelId,
          bookingId: selected.id,
          nights,
          withholdNights,
          paymentMethod: method,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось провести возврат");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const showList = useMemo(
    () => !selected && (query.length > 0 || candidates.length > 0),
    [selected, query, candidates.length]
  );

  if (!activeHotelId) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl p-6 max-w-sm border border-border text-center">
          <p className="text-[13px] text-muted-foreground">Выберите конкретный отель для возврата</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-[12px] font-bold rounded-lg bg-muted">Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-[520px] border border-border max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-foreground flex items-center gap-2">
              <RotateCcw size={16} /> Возврат за проживание
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">С учётом скидок и удержания за позднее предупреждение</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {!selected ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по имени гостя…"
                  className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              {loading && <p className="text-[12px] text-muted-foreground text-center">Поиск…</p>}
              {showList && (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-[13px] font-bold text-foreground">{c.guestName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        №{c.roomNumber} · оплачено {c.prepaidNights} ноч. · к возврату {c.refundableNights} ноч.
                      </div>
                    </button>
                  ))}
                  {!loading && candidates.length === 0 && query && (
                    <p className="text-[12px] text-muted-foreground text-center py-4">Гости не найдены</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                ← Другой гость
              </button>
              <div className="rounded-xl border border-border p-4 bg-muted/30">
                <div className="text-[14px] font-bold text-foreground">{selected.guestName}</div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  №{selected.roomNumber} · {fmtDate(selected.checkIn, true)} → {fmtDate(selected.checkOut, true)}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                  <div className="rounded-lg bg-card p-2 border border-border">
                    <div className="text-muted-foreground">Оплачено ночей</div>
                    <div className="font-black text-foreground">{selected.prepaidNights}</div>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border">
                    <div className="text-muted-foreground">Прожито</div>
                    <div className="font-black text-foreground">{selected.consumedNights}</div>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-border col-span-2">
                    <div className="text-muted-foreground">Доступно к возврату</div>
                    <div className="font-black text-success">
                      {quote?.maxRefundNights ?? selected.refundableNights} ноч. · до {money(selected.maxRefundAmount)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-muted-foreground block mb-1.5">Удержать оплату (позднее предупреждение)</label>
                <div className="flex gap-2">
                  {([
                    [0, "Не удерживать"],
                    [1, "1 ночь"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setWithholdNights(v)}
                      className="flex-1 py-2 text-[12px] font-bold rounded-lg border transition-all"
                      style={{
                        borderColor: withholdNights === v ? "#EF4444" : "hsl(var(--border))",
                        background: withholdNights === v ? "#FEF2F2" : undefined,
                        color: withholdNights === v ? "#DC2626" : undefined,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-muted-foreground block mb-1.5">Ночей к возврату</label>
                <input
                  type="number"
                  min={1}
                  max={quote?.maxRefundNights ?? maxNights}
                  value={nights}
                  onChange={(e) =>
                    setNights(
                      Math.min(
                        quote?.maxRefundNights ?? selected.refundableNights,
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    )
                  }
                  className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {quoteLoading ? "Расчёт…" : `Сумма: ${money(refundAmount)}`}
                </p>
                {quote?.recalcNote && (
                  <p className="text-[11px] text-amber-700 mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                    {quote.recalcNote}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[12px] font-bold text-muted-foreground block mb-2">Способ возврата</label>
                <div className="grid grid-cols-2 gap-2">
                  {pmEntries.map(([k, cfg]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMethod(k)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left border-2 transition-all"
                      style={{
                        borderColor: method === k ? cfg.color : "hsl(var(--border))",
                        background: method === k ? cfg.bg : undefined,
                        color: method === k ? cfg.color : undefined,
                      }}
                    >
                      <Icon name={cfg.icon} size={14} />
                      <span className="text-[12px] font-semibold">{cfg.label}</span>
                      {method === k && <Check size={12} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-muted-foreground block mb-1.5">Комментарий</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Необязательно…"
                  className="w-full px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        {selected && (
          <div className="px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={submit}
              disabled={busy || nights <= 0 || nights > (quote?.maxRefundNights ?? selected.refundableNights) || refundAmount <= 0}
              className="w-full py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}
            >
              {busy ? "Проведение…" : `Вернуть ${money(refundAmount)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
