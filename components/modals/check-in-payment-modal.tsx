"use client";

import { useMemo, useState } from "react";
import { X, CreditCard, Check, Tag } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { Icon } from "@/components/icon";
import { money, dayDiff } from "@/lib/format";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  activeRulesForHotel,
  calcPaymentWithRule,
  formatRuleLabel,
  hotelHasDiscountRules,
  matchDiscountRule,
  paymentNightlyWithRule,
} from "@/lib/hotel-discount-rules";
import type { Booking } from "@/lib/types";
import type { GuestFormData } from "@/lib/guest-form";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { OtaChannelSelect } from "@/components/ui/ota-channel-select";

export function CheckInPaymentModal({
  booking,
  form,
  migRegSubmitted,
  migRegNotifNumber,
  onClose,
  onDone,
}: {
  booking: Booking;
  form: GuestFormData;
  migRegSubmitted: boolean;
  migRegNotifNumber: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { rooms, pmConfig, channels, hotelDiscountRules, refresh } = useApp();
  const room = rooms.find((r) => r.id === booking.roomId);
  const nights = dayDiff(booking.checkIn, booking.checkOut);
  const roomPrice = room?.price ?? 0;

  const hotelRules = useMemo(
    () => activeRulesForHotel(hotelDiscountRules, booking.hotelId),
    [hotelDiscountRules, booking.hotelId]
  );
  const useRules = hotelHasDiscountRules(hotelDiscountRules, booking.hotelId);

  const [discountPercent, setDiscountPercent] = useState("");
  const [discountPerNight, setDiscountPerNight] = useState("");
  const [paymentNights, setPaymentNights] = useState("1");
  const [method, setMethod] = useState("cash");
  const [channelId, setChannelId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const perNight = Math.max(0, Number(discountPerNight) || 0);
  const payNights = Math.max(1, Math.min(nights, Math.round(Number(paymentNights) || 1)));

  const matchedRule = useMemo(() => {
    if (!useRules) return null;
    return matchDiscountRule(hotelRules, { paymentNights: payNights, paymentMethod: method });
  }, [useRules, hotelRules, payNights, method]);

  const totalAmount = useMemo(
    () =>
      calcStayAmount({
        roomPrice,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        discountPercent: useRules ? booking.discountPercent ?? 0 : pct,
        discountPerNight: useRules ? booking.discountPerNight ?? 0 : perNight,
      }),
    [roomPrice, booking, pct, perNight, useRules]
  );

  const rulePaymentAmount = useRules
    ? calcPaymentWithRule(roomPrice, payNights, matchedRule)
    : 0;

  const manualNightly = nights > 0 ? Math.round(totalAmount / nights) : roomPrice;
  const manualPayAmount = payNights * manualNightly;

  const expectedPay = useRules ? rulePaymentAmount : manualPayAmount;
  const debt = Math.max(0, totalAmount - booking.paid);

  const pmEntries = Object.entries(pmConfig);
  const pmLabels = useMemo(
    () => Object.fromEntries(pmEntries.map(([k, v]) => [k, v.label])),
    [pmEntries]
  );

  async function submit() {
    setError("");
    const pay = debt > 0 ? Math.round(Number(paymentAmount) || expectedPay) : 0;
    if (debt > 0 && pay <= 0) {
      setError("Укажите сумму оплаты");
      return;
    }
    if (debt > 0 && method === OTA_PAYMENT_CODE && !channelId) {
      setError("Выберите канал OTA");
      return;
    }
    if (debt > 0 && Math.abs(pay - expectedPay) > 1) {
      setError("Сумма не совпадает с тарифом за выбранный период");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form,
          regCardSigned: true,
          migRegSubmitted,
          migRegNotifNumber: migRegNotifNumber.trim() || undefined,
          paymentMethod: method,
          paymentAmount: pay,
          paymentNights: payNights,
          channelId: method === OTA_PAYMENT_CODE ? channelId : undefined,
          discountPercent: useRules ? 0 : pct,
          discountPerNight: useRules ? 0 : perNight,
          discountRuleId: matchedRule?.id,
          skipPayment: debt <= 0,
        }),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text) as { error?: string };
        } catch {
          /* не JSON */
        }
      }
      if (!res.ok) {
        setError(data.error || `Ошибка сервера (${res.status})`);
        return;
      }
      await refresh();
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-[440px] border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Оплата проживания</h2>
            <p className="text-[12px] text-muted-foreground">{booking.guestName} · №{room?.number} · {nights} ноч.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl p-4 bg-muted border border-border space-y-2 text-[12px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Тариф</span><span className="font-semibold">{money(roomPrice)}/сут.</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Базовая сумма</span><span className="font-semibold">{money(roomPrice * nights)}</span></div>
            {booking.paid > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Уже оплачено</span><span className="font-semibold text-success">{money(booking.paid)}</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-bold text-foreground">К оплате</span>
              <span className="text-[18px] font-black text-primary">{money(debt > 0 ? expectedPay : totalAmount)}</span>
            </div>
          </div>

          {debt > 0 && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Ночей к оплате</label>
              <input
                type="number"
                min={1}
                max={nights}
                value={paymentNights}
                onChange={(e) => {
                  setPaymentNights(e.target.value);
                  setPaymentAmount("");
                }}
                className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {useRules ? (
            <div
              className="rounded-xl p-3 border flex items-start gap-2"
              style={{ borderColor: matchedRule ? "#10B981" : "hsl(var(--border))", background: matchedRule ? "#ECFDF5" : undefined }}
            >
              <Tag size={14} className={matchedRule ? "text-success mt-0.5" : "text-muted-foreground mt-0.5"} />
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Скидка</div>
                {matchedRule ? (
                  <div className="text-[12px] font-bold text-success">{formatRuleLabel(matchedRule, pmLabels)}</div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">Не применяется при текущих условиях</div>
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

          {debt > 0 && (
            <>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Сумма оплаты</label>
                <input
                  type="number"
                  value={paymentAmount || String(expectedPay)}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={String(expectedPay)}
                  className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {payNights} ноч. × {money(useRules ? paymentNightlyWithRule(roomPrice, payNights, matchedRule) : manualNightly)}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-2">Способ оплаты</label>
                <div className="grid grid-cols-2 gap-2">
                  {pmEntries.map(([code, cfg]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setMethod(code);
                        if (code !== OTA_PAYMENT_CODE) setChannelId("");
                        setPaymentAmount("");
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                      style={{
                        background: method === code ? cfg.bg : undefined,
                        border: `2px solid ${method === code ? cfg.color : "hsl(var(--border))"}`,
                        color: method === code ? cfg.color : undefined,
                      }}
                    >
                      <Icon name={cfg.icon} size={13} />
                      <span className="text-[11px] font-semibold">{cfg.label}</span>
                      {method === code && <Check size={11} className="ml-auto" />}
                    </button>
                  ))}
                </div>
                {method === OTA_PAYMENT_CODE && (
                  <div className="mt-3">
                    <OtaChannelSelect
                      hotelId={booking.hotelId}
                      channels={channels}
                      value={channelId}
                      onChange={setChannelId}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
          >
            <CreditCard size={14} /> {busy ? "Заселение…" : debt > 0 ? "Оплатить и заселить" : "Заселить"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-muted text-muted-foreground">Отмена</button>
        </div>
      </div>
    </div>
  );
}
