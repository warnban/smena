"use client";

import { useMemo, useState } from "react";
import { X, CreditCard } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { money } from "@/lib/format";
import { calcStayAmount } from "@/lib/booking-pricing";
import { hotelHasDiscountRules } from "@/lib/hotel-discount-rules";
import type { Booking } from "@/lib/types";
import type { GuestFormData } from "@/lib/guest-form";
import { BookingPaymentForm, type BookingPaymentPayload } from "@/components/bookings/booking-payment-form";

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
  const { rooms, hotelDiscountRules, refresh } = useApp();
  const room = rooms.find((r) => r.id === booking.roomId);
  const roomPrice = room?.price ?? 0;
  const useRules = hotelHasDiscountRules(hotelDiscountRules, booking.hotelId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = useMemo(
    () =>
      calcStayAmount({
        roomPrice,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        discountPercent: booking.discountPercent ?? 0,
        discountPerNight: booking.discountPerNight ?? 0,
      }),
    [roomPrice, booking]
  );

  const debt = Math.max(0, totalAmount - booking.paid);
  const needsPayment = debt > 0;

  async function submitCheckIn(payload?: BookingPaymentPayload): Promise<boolean> {
    setError("");
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
          skipPayment: !needsPayment,
          ...(payload
            ? {
                paymentMethod: payload.paymentMethod,
                paymentAmount: payload.amount,
                paymentNights: payload.nights,
                paidThroughDate: payload.paidThroughDate,
                note: payload.note,
                channelId: payload.channelId,
                discountPercent: useRules ? 0 : payload.discountPercent,
                discountPerNight: useRules ? 0 : payload.discountPerNight,
                discountRuleId: payload.discountRuleId,
              }
            : {}),
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
        return false;
      }
      await refresh();
      onDone?.();
      onClose();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handlePayment(payload: BookingPaymentPayload) {
    return submitCheckIn(payload);
  }

  async function handleCheckInWithoutPayment() {
    await submitCheckIn();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-[520px] border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Оплата проживания</h2>
            <p className="text-[12px] text-muted-foreground">
              {booking.guestName} · №{room?.number}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {needsPayment ? (
            <BookingPaymentForm
              booking={booking}
              roomPrice={roomPrice}
              transactions={[]}
              onSubmit={handlePayment}
              busy={busy}
              showSubmit
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-muted border border-border text-center">
                <div className="text-[11px] font-bold text-muted-foreground uppercase mb-1">Проживание оплачено</div>
                <div className="text-[22px] font-black text-success">{money(totalAmount)}</div>
                <p className="text-[11px] text-muted-foreground mt-2">Можно заселить без дополнительной оплаты</p>
              </div>
              {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
              <button
                type="button"
                onClick={handleCheckInWithoutPayment}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
              >
                <CreditCard size={14} /> {busy ? "Заселение…" : "Заселить"}
              </button>
            </div>
          )}
          {needsPayment && error && (
            <p className="text-[12px] text-destructive font-semibold mt-3">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
