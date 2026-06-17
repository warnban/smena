"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Tag } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { Icon } from "@/components/icon";
import { DatePicker } from "@/components/ui/date-picker";
import { OtaChannelSelect } from "@/components/ui/ota-channel-select";
import { money, fmtDate } from "@/lib/format";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  accommodationPaidTotal,
  bookingNightlyRate,
  bookingStayNights,
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughDateKey,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import {
  activeRulesForHotel,
  calcPaymentWithRule,
  formatRuleLabel,
  hotelHasDiscountRules,
  matchDiscountRule,
  paymentNightlyWithRule,
} from "@/lib/hotel-discount-rules";
import type { Booking, Transaction } from "@/lib/types";

export type BookingPaymentPayload = {
  amount: number;
  nights: number;
  paidThroughDate: string;
  paymentMethod: string;
  note?: string;
  channelId?: string;
  discountPercent: number;
  discountPerNight: number;
  discountRuleId?: string;
};

type PeriodMode = "nights" | "date";

export function BookingPaymentForm({
  booking,
  roomPrice,
  transactions,
  onSubmit,
  busy = false,
  showSubmit = true,
}: {
  booking: Booking;
  roomPrice: number;
  transactions?: Transaction[];
  onSubmit: (payload: BookingPaymentPayload) => Promise<boolean>;
  busy?: boolean;
  showSubmit?: boolean;
}) {
  const { pmConfig, channels, hotelDiscountRules } = useApp();
  const checkOutKey = mskDateKey(booking.checkOut);
  const stayNights = bookingStayNights(booking);

  const hotelRules = useMemo(
    () => activeRulesForHotel(hotelDiscountRules, booking.hotelId),
    [hotelDiscountRules, booking.hotelId]
  );
  const useRules = hotelHasDiscountRules(hotelDiscountRules, booking.hotelId);

  const [discountPercent, setDiscountPercent] = useState(String(booking.discountPercent ?? 0));
  const [discountPerNight, setDiscountPerNight] = useState(String(booking.discountPerNight ?? 0));
  const [periodMode, setPeriodMode] = useState<PeriodMode>("nights");
  const [nightsCount, setNightsCount] = useState("1");
  const [paidThrough, setPaidThrough] = useState("");
  const [method, setMethod] = useState("cash");
  const [channelId, setChannelId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!useRules) {
      setDiscountPercent(String(booking.discountPercent ?? 0));
      setDiscountPerNight(String(booking.discountPerNight ?? 0));
    }
  }, [booking.id, booking.discountPercent, booking.discountPerNight, booking.paid, booking.amount, useRules]);

  const pct = Math.max(0, Math.min(100, Math.round(Number(discountPercent) || 0)));
  const perNight = Math.max(0, Math.round(Number(discountPerNight) || 0));
  const discountChanged =
    !useRules && (pct !== (booking.discountPercent ?? 0) || perNight !== (booking.discountPerNight ?? 0));

  const quoteAmount = useMemo(
    () =>
      calcStayAmount({
        roomPrice,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        discountPercent: pct,
        discountPerNight: perNight,
      }),
    [roomPrice, booking.checkIn, booking.checkOut, pct, perNight]
  );

  const contractAmount = booking.amount;
  const totalAmount = discountChanged ? quoteAmount : contractAmount;

  const effectivePaid = useMemo(
    () => accommodationPaidTotal(booking, transactions),
    [booking, transactions]
  );

  const contractBooking = useMemo(
    () => ({ ...booking, paid: effectivePaid, amount: contractAmount }),
    [booking, effectivePaid, contractAmount]
  );

  const contractNightly = bookingNightlyRate(contractBooking);
  const quoteNightly = stayNights > 0 ? Math.round(quoteAmount / stayNights) : 0;

  const firstUnpaidKey = firstUnpaidNightDateKey(contractBooking, undefined, transactions);
  const currentPaidThrough = paidThroughDateKey(contractBooking, undefined, transactions);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const maxPaidThroughKey = checkOutKey;
  const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));

  const selectedNights = useMemo(() => {
    if (periodMode === "nights") {
      const n = Math.max(1, Math.round(Number(nightsCount) || 1));
      return Math.min(n, maxPayNights);
    }
    if (!paidThrough) return 1;
    const n = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThrough);
    return Math.max(1, Math.min(n, maxPayNights));
  }, [periodMode, nightsCount, paidThrough, firstUnpaidKey, maxPayNights]);

  const selectedPaidThrough = useMemo(() => {
    if (periodMode === "date" && paidThrough) return paidThrough;
    return mskAddDays(firstUnpaidKey, selectedNights - 1);
  }, [periodMode, paidThrough, firstUnpaidKey, selectedNights]);

  const matchedRule = useMemo(() => {
    if (!useRules) return null;
    return matchDiscountRule(hotelRules, { paymentNights: selectedNights, paymentMethod: method });
  }, [useRules, hotelRules, selectedNights, method]);

  const paymentNightly = useRules
    ? paymentNightlyWithRule(roomPrice, selectedNights, matchedRule)
    : discountChanged
      ? quoteNightly
      : contractNightly;

  const paymentAmount = useRules
    ? calcPaymentWithRule(roomPrice, selectedNights, matchedRule)
    : selectedNights * paymentNightly;

  const contractDebt = Math.max(0, contractAmount - effectivePaid);
  const pmEntries = Object.entries(pmConfig);
  const pmLabels = useMemo(
    () => Object.fromEntries(pmEntries.map(([k, v]) => [k, v.label])),
    [pmEntries]
  );

  useEffect(() => {
    setPaidThrough(mskAddDays(firstUnpaidKey, Math.max(0, selectedNights - 1)));
  }, [firstUnpaidKey, selectedNights]);

  async function handleSubmit() {
    setError("");
    if (paymentAmount <= 0) {
      setError("Сумма оплаты должна быть больше нуля");
      return;
    }
    if (method === OTA_PAYMENT_CODE && !channelId) {
      setError("Выберите канал OTA");
      return;
    }
    const ok = await onSubmit({
      amount: paymentAmount,
      nights: selectedNights,
      paidThroughDate: selectedPaidThrough,
      paymentMethod: method,
      note: note.trim() || undefined,
      channelId: method === OTA_PAYMENT_CODE ? channelId : undefined,
      discountPercent: useRules ? 0 : pct,
      discountPerNight: useRules ? 0 : perNight,
      discountRuleId: matchedRule?.id,
    });
    if (!ok) setError("Не удалось принять платёж");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["Стоимость", money(totalAmount), "text-foreground"], ["Оплачено", money(effectivePaid), "text-success"], ["По договору", money(contractDebt), contractDebt > 0 ? "text-destructive" : "text-success"]].map(([l, v, c]) => (
          <div key={String(l)} className="rounded-xl p-3 text-center bg-muted border border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{l}</div>
            <div className={`text-[18px] font-black ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 bg-muted/60 border border-border space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Тариф по договору</span>
          <span className="font-semibold text-right">{money(contractNightly)}/сут.</span>
        </div>
        {prepaid > 0 && currentPaidThrough && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Сейчас оплачено до</span>
            <span className="font-semibold">{fmtDate(parseMskDate(currentPaidThrough))} 12:00 · {prepaid} н.</span>
          </div>
        )}
        <div className="flex justify-between gap-2 pt-1 border-t border-border">
          <span className="text-muted-foreground">Следующая оплата с</span>
          <span className="font-bold text-foreground">{fmtDate(parseMskDate(firstUnpaidKey))}</span>
        </div>
        {effectivePaid > booking.paid && (
          <p className="text-[10px] text-muted-foreground">
            Включая платёж при заселении ({money(effectivePaid - booking.paid)} из транзакций)
          </p>
        )}
      </div>

      {useRules ? (
        <div
          className="rounded-xl p-4 border-2 flex items-start gap-3"
          style={{
            borderColor: matchedRule ? "#10B981" : "hsl(var(--border))",
            background: matchedRule ? "#ECFDF5" : undefined,
          }}
        >
          <Tag size={16} className={matchedRule ? "text-success mt-0.5" : "text-muted-foreground mt-0.5"} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-muted-foreground uppercase mb-1">Скидка по правилам отеля</div>
            {matchedRule ? (
              <>
                <div className="text-[13px] font-bold text-success">{formatRuleLabel(matchedRule, pmLabels)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Экономия {money(selectedNights * roomPrice - paymentAmount)} за {selectedNights} ноч.
                </div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">
                При {selectedNights} ноч. и выбранном способе оплаты скидка не применяется
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Скидка, %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Скидка, ₽/сут.</label>
            <input
              type="number"
              min={0}
              value={discountPerNight}
              onChange={(e) => setDiscountPerNight(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-[12px] font-bold text-muted-foreground block mb-2">Период оплаты</label>
        <div className="flex gap-2 mb-3">
          {([
            ["nights", "Кол-во ночей"],
            ["date", "Оплачено до"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodMode(id)}
              className="flex-1 py-2 text-[12px] font-bold rounded-lg border transition-all"
              style={{
                borderColor: periodMode === id ? "#10B981" : "hsl(var(--border))",
                background: periodMode === id ? "#ECFDF5" : undefined,
                color: periodMode === id ? "#059669" : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {periodMode === "nights" ? (
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Ночей</label>
            <input
              type="number"
              min={1}
              max={maxPayNights}
              value={nightsCount}
              onChange={(e) => setNightsCount(e.target.value)}
              className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-1">До {fmtDate(parseMskDate(selectedPaidThrough))} 12:00</p>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Оплачено до (до 12:00)</label>
            <DatePicker
              mode="iso"
              value={paidThrough}
              onChange={setPaidThrough}
              min={firstUnpaidKey}
              max={maxPaidThroughKey}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{selectedNights} ноч. · {money(paymentAmount)}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl p-4 border-2 border-primary/30 bg-primary/5 flex justify-between items-center">
        <div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase">К оплате</div>
          <div className="text-[10px] text-muted-foreground">{selectedNights} ноч. × {money(paymentNightly)}</div>
        </div>
        <div className="text-[22px] font-black text-primary">{money(paymentAmount)}</div>
      </div>

      <div>
        <label className="text-[12px] font-bold text-muted-foreground block mb-2">Способ оплаты</label>
        <div className="grid grid-cols-2 gap-2">
          {pmEntries.map(([k, cfg]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setMethod(k);
                if (k !== OTA_PAYMENT_CODE) setChannelId("");
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: method === k ? cfg.bg : undefined,
                border: `2px solid ${method === k ? cfg.color : "hsl(var(--border))"}`,
                color: method === k ? cfg.color : undefined,
              }}
            >
              <Icon name={cfg.icon} size={14} />
              <span className="text-[12px] font-semibold">{cfg.label}</span>
              {method === k && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>
        {method === OTA_PAYMENT_CODE && (
          <div className="mt-3">
            <OtaChannelSelect hotelId={booking.hotelId} channels={channels} value={channelId} onChange={setChannelId} />
          </div>
        )}
      </div>

      <div>
        <label className="text-[12px] font-bold text-muted-foreground block mb-1.5">Примечание</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Необязательно..."
          className="w-full px-3 py-2 text-[12px] rounded-xl outline-none focus:ring-1 focus:ring-ring border border-border bg-muted text-foreground"
        />
      </div>

      {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}

      {showSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || paymentAmount <= 0 || (method === OTA_PAYMENT_CODE && !channelId)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
        >
          <CreditCard size={14} /> Принять платёж
        </button>
      )}
    </div>
  );
}

function parseMskDate(key: string): Date {
  return new Date(`${key.slice(0, 10)}T12:00:00+03:00`);
}
