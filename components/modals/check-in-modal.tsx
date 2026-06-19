"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, Shield, FileText, Check, UserCheck, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { GuestFormFields } from "@/components/forms/guest-form-fields";
import { DocumentScanUpload } from "@/components/forms/document-scan-upload";
import { Icon } from "@/components/icon";
import { fmtDate, dayDiff } from "@/lib/format";
import {
  guestToForm,
  formDisplayName,
  migRegDeadlineFrom,
  effectiveMigStatus,
  validateCheckInForm,
  type GuestFormData,
} from "@/lib/guest-form";
import { MIG_REG_STATUS } from "@/lib/constants";
import type { Booking, Guest } from "@/lib/types";
import { CheckInPaymentModal } from "@/components/modals/check-in-payment-modal";
import { CheckInPrintModal } from "@/components/modals/check-in-print-modal";

export function CheckInModal({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { guests, rooms, hotels, currentUser, getCategoryLabel, refreshSilent } = useApp();
  const guest = guests.find((g) => g.id === booking.guestId);
  const room = rooms.find((r) => r.id === booking.roomId);
  const hotel = hotels.find((h) => h.id === booking.hotelId);

  const [tab, setTab] = useState<"card" | "migration">("card");
  const [form, setForm] = useState<GuestFormData>(() => (guest ? guestToForm(guest) : guestToForm({} as Guest)));
  const [effectiveForeigner, setEffectiveForeigner] = useState(guest?.isForeigner ?? false);
  const [signed, setSigned] = useState(guest?.regCardSigned ?? false);
  const [migSubmitted, setMigSubmitted] = useState(
    guest?.migRegStatus === "submitted"
  );
  const [migNotifNumber, setMigNotifNumber] = useState(guest?.migRegNotifNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const modalLocked = busy || scanBusy;

  useEffect(() => {
    if (guest) {
      setForm(guestToForm(guest));
      setEffectiveForeigner(guest.isForeigner);
      setSigned(guest.regCardSigned);
      setMigSubmitted(guest.migRegStatus === "submitted");
      setMigNotifNumber(guest.migRegNotifNumber ?? "");
    }
    // Только при открытии модалки для другого бронирования
  }, [booking.id]);

  const nights = dayDiff(booking.checkIn, booking.checkOut);
  const displayGuestName = useMemo(() => formDisplayName(form) || guest?.name || "", [form, guest?.name]);
  const deadline = useMemo(
    () => guest?.migRegDeadline || migRegDeadlineFrom(booking.checkIn),
    [guest, booking.checkIn]
  );
  const migStatus = effectiveForeigner
    ? effectiveMigStatus(migSubmitted ? "submitted" : guest?.migRegStatus ?? "pending", deadline)
    : "not_required";
  const migCfg = MIG_REG_STATUS[migStatus];

  if (!guest) return null;

  async function proceedToPrint() {
    setError("");
    if (!signed) {
      setError("Подтвердите подписание регистрационной карточки");
      return;
    }
    const validationErrors = validateCheckInForm({ isForeigner: effectiveForeigner }, form);
    if (validationErrors.length) {
      setError(validationErrors.join("; "));
      setTab("card");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/guests/${guest!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, regCardSigned: true, isForeigner: effectiveForeigner, bookingId: booking.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить данные гостя");
        return;
      }
      await refreshSilent();
      setPrintOpen(true);
    } catch {
      setError("Ошибка сохранения данных гостя");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={modalLocked ? undefined : onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl flex flex-col w-full max-w-[760px] border border-border max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-start justify-between border-b border-border bg-muted/30 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <Shield size={15} className="text-primary" />
              <h2 className="text-[15px] font-bold text-foreground">Регистрация гостя · №{room?.number}</h2>
              {!signed ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Не подписана</span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">Подписана</span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Форма №5 · {fmtDate(booking.checkIn)} — {fmtDate(booking.checkOut)} · {nights} ночей
            </p>
          </div>
          <button onClick={modalLocked ? undefined : onClose} disabled={modalLocked} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="flex px-6 border-b border-border">
          <button
            onClick={() => setTab("card")}
            className={`px-4 py-3 text-[13px] font-semibold ${tab === "card" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            Регистрационная карточка
          </button>
          {effectiveForeigner && (
            <button
              onClick={() => setTab("migration")}
              className={`px-4 py-3 text-[13px] font-semibold flex items-center gap-2 ${tab === "migration" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
            >
              Миграционный учёт
              {(migStatus === "pending" || migStatus === "overdue") && (
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {tab === "card" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl text-[12px] bg-accent border border-primary/20">
                <FileText size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="text-foreground/90">
                  <strong>Форма №5</strong> — заполняется при заселении. Основание: ПП РФ №1611.
                </div>
              </div>
              <DocumentScanUpload
                guestId={guest.id}
                guestIsForeigner={effectiveForeigner}
                form={form}
                disabled={busy}
                onBusyChange={setScanBusy}
                onApplied={async ({ form: next, suggestedIsForeigner }) => {
                  setForm(next);
                  setEffectiveForeigner(suggestedIsForeigner);
                  setTab("card");
                  try {
                    await fetch(`/api/guests/${guest.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ form: next, isForeigner: suggestedIsForeigner }),
                    });
                  } catch {
                    /* черновик — не блокируем UI */
                  }
                  void refreshSilent();
                }}
              />
              <GuestFormFields form={form} setForm={setForm} isForeigner={effectiveForeigner} />
              <div className="rounded-xl overflow-hidden border border-border">
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase bg-muted border-b border-border">
                  4. Сведения о проживании
                </div>
                <div className="p-3 space-y-1 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Гостиница</span><span className="font-semibold">{hotel?.name}, {hotel?.city}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Номер</span><span className="font-semibold">№{room?.number} · {room ? getCategoryLabel(room.category) : ""}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Заезд / выезд</span><span className="font-semibold">{fmtDate(booking.checkIn)} — {fmtDate(booking.checkOut)}</span></div>
                </div>
              </div>
            </div>
          )}

          {tab === "migration" && effectiveForeigner && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: migCfg.bg, border: `1px solid ${migCfg.color}30` }}>
                <Icon name={migCfg.icon} size={22} style={{ color: migCfg.color }} />
                <div>
                  <div className="text-[13px] font-bold" style={{ color: migCfg.color }}>{migCfg.label}</div>
                  {migStatus !== "submitted" && (
                    <div className="text-[12px] text-destructive mt-0.5">Крайний срок: {deadline}</div>
                  )}
                  {migStatus === "submitted" && guest.migRegSubmittedAt && (
                    <div className="text-[12px] text-muted-foreground mt-0.5">Подано {guest.migRegSubmittedAt}</div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl text-[11px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                Гостиница обязана направить уведомление в МВД в течение 1 рабочего дня (ФЗ №109-ФЗ).
              </div>
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase">Уведомление о прибытии</p>
                {guest.migRegStatus === "submitted" ? (
                  <div className="flex items-center gap-2 text-success text-[13px] font-bold">
                    <ShieldCheck size={18} /> Уведомление уже отправлено
                    {guest.migRegNotifNumber && <span className="text-muted-foreground font-normal">№{guest.migRegNotifNumber}</span>}
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input type="checkbox" checked={migSubmitted} onChange={(e) => setMigSubmitted(e.target.checked)} />
                      Уведомление в МВД направлено
                    </label>
                    {migSubmitted && (
                      <input
                        value={migNotifNumber}
                        onChange={(e) => setMigNotifNumber(e.target.value)}
                        placeholder="Номер уведомления (необязательно)"
                        className="w-full px-3 py-2 text-[12px] rounded-lg border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-[12px] text-destructive font-semibold p-3 rounded-lg bg-destructive/10">{error}</p>
          )}
        </div>

        <div className="px-6 py-3.5 flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 rounded-b-2xl">
          {!signed && (
            <button
              onClick={() => setSigned(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}
            >
              <Check size={14} /> Подтвердить подписание карточки
            </button>
          )}
          {signed && (
            <button
              onClick={proceedToPrint}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              <UserCheck size={14} /> {busy ? "Сохранение…" : "Заселить"}
            </button>
          )}
          {signed && currentUser && (
            <span className="text-[11px] text-muted-foreground">Администратор: {currentUser.name}</span>
          )}
          <button onClick={modalLocked ? undefined : onClose} disabled={modalLocked} className="ml-auto px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40">
            Закрыть
          </button>
        </div>
      </div>
    </div>
    {printOpen && (
      <CheckInPrintModal
        guestId={guest.id}
        bookingId={booking.id}
        guestName={displayGuestName}
        onClose={() => setPrintOpen(false)}
        onContinue={() => {
          setPrintOpen(false);
          setPaymentOpen(true);
        }}
      />
    )}
    {paymentOpen && (
      <CheckInPaymentModal
        booking={booking}
        form={form}
        migRegSubmitted={effectiveForeigner && migSubmitted}
        migRegNotifNumber={migNotifNumber}
        onClose={() => setPaymentOpen(false)}
        onDone={() => { setPaymentOpen(false); onDone?.(); onClose(); }}
      />
    )}
    </>
  );
}
