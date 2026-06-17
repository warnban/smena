"use client";

import { useEffect, useState } from "react";
import { X, Printer, Download, FileText } from "lucide-react";
import { fmtDate } from "@/lib/format";
import {
  GUEST_FORM_TEMPLATES,
  STAY_AMENDMENT_FORM_ID,
  type GuestFormId,
} from "@/lib/guest-print-forms";
import { Select } from "@/components/ui/select";

type PreviewBooking = {
  id: string;
  hotelName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
};

export function GuestPrintModal({
  guestId,
  formId,
  onClose,
}: {
  guestId: string;
  formId: GuestFormId;
  onClose: () => void;
}) {
  const meta = GUEST_FORM_TEMPLATES[formId];
  const isAmendment = formId === STAY_AMENDMENT_FORM_ID;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [context, setContext] = useState<Record<string, string> | null>(null);
  const [bookings, setBookings] = useState<PreviewBooking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [templateReady, setTemplateReady] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadPreview(selectedBookingId?: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/guests/${guestId}/forms/${formId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: selectedBookingId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Не удалось загрузить данные");
      return;
    }
    setContext(data.context);
    setBookings(data.bookings ?? []);
    setBookingId(data.selectedBookingId);
    setTemplateReady(Boolean(data.templateReady));
  }

  useEffect(() => {
    if (isAmendment) {
      setLoading(false);
      setError("");
      setContext(null);
      return;
    }
    loadPreview();
  }, [guestId, formId, isAmendment]);

  function printPageUrl(previewOnly = false) {
    const q = new URLSearchParams({
      guestId,
      formId,
      print: previewOnly ? "0" : "1",
    });
    if (bookingId) q.set("bookingId", bookingId);
    return `/guests/form-print?${q.toString()}`;
  }

  function downloadUrl() {
    const q = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}&format=docx` : "?format=docx";
    return `/api/guests/${guestId}/forms/${formId}${q}`;
  }

  async function confirmPrint() {
    if (!templateReady) return;
    setBusy(true);
    window.open(printPageUrl(false), "_blank", "noopener,noreferrer");
    setBusy(false);
    onClose();
  }

  function openPreview() {
    if (!templateReady) return;
    window.open(printPageUrl(true), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-primary flex-shrink-0" />
            <h2 className="text-[14px] font-bold truncate">{meta.label}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {isAmendment ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">
              Дополнительное соглашение формируется автоматически при изменении срока проживания в карточке брони.
              Готовые документы — в блоке «Доп. соглашения к договору» ниже.
            </p>
          ) : loading ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">Подготовка данных…</p>
          ) : error ? (
            <p className="text-[13px] text-destructive font-semibold text-center py-4">{error}</p>
          ) : context ? (
            <>
              {!templateReady && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-900 dark:text-amber-200">
                  Файл <code className="font-mono">{meta.filename}</code> не найден в{" "}
                  <code className="font-mono">templates/guest-forms/</code>. Загрузите шаблон Word (см. README в папке).
                </div>
              )}

              {bookings.length > 1 && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Бронирование</label>
                  <Select
                    size="sm"
                    value={bookingId}
                    onChange={(v) => {
                      setBookingId(v);
                      loadPreview(v);
                    }}
                    options={bookings.map((b) => ({
                      value: b.id,
                      label: `${b.hotelName} · №${b.roomNumber} · ${fmtDate(b.checkIn, true)} — ${fmtDate(b.checkOut, true)}`,
                    }))}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5 text-[12px]">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Будет подставлено</p>
                <Row label="Гость" value={context.guest_fio} />
                <Row label="Гостиница" value={context.hotel_name} />
                <Row label="Юр. лицо" value={context.hotel_legal_name} />
                <Row label="Период" value={context.stay_period} />
                <Row label="Номер" value={context.room_number} />
                <Row label="Сайт" value={context.hotel_website || "—"} />
              </div>
            </>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-wrap gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 min-w-[100px] py-2.5 text-[13px] font-semibold rounded-xl bg-muted">
            Отмена
          </button>
          {templateReady && context && (
            <>
              <button
                type="button"
                onClick={openPreview}
                className="flex items-center justify-center gap-1.5 flex-1 min-w-[120px] py-2.5 text-[13px] font-semibold rounded-xl border border-border hover:bg-muted/80"
              >
                <FileText size={14} /> Предпросмотр
              </button>
              <a
                href={downloadUrl()}
                className="flex items-center justify-center gap-1.5 flex-1 min-w-[100px] py-2.5 text-[13px] font-semibold rounded-xl border border-border hover:bg-muted"
              >
                <Download size={14} /> Word
              </a>
              <button
                type="button"
                onClick={confirmPrint}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 flex-1 min-w-[100px] py-2.5 text-[13px] font-bold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50"
              >
                <Printer size={14} /> {busy ? "…" : "Печать"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
