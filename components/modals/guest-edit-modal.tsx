"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import { GuestFormFields } from "@/components/forms/guest-form-fields";
import { DocumentScanUpload } from "@/components/forms/document-scan-upload";
import { useApp } from "@/components/providers/app-data";
import { guestToForm, validateCheckInForm, type GuestFormData } from "@/lib/guest-form";
import type { Guest } from "@/lib/types";

export function GuestEditModal({
  guest,
  onClose,
  onSaved,
}: {
  guest: Guest;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { refreshSilent } = useApp();
  const [form, setForm] = useState<GuestFormData>(() => guestToForm(guest));
  const [effectiveForeigner, setEffectiveForeigner] = useState(guest.isForeigner);
  const [scanBusy, setScanBusy] = useState(false);
  const [vip, setVip] = useState(guest.vip);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const validationErrors = validateCheckInForm({ isForeigner: effectiveForeigner }, form);
    if (validationErrors.length) {
      setError(validationErrors.join("; "));
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, vip, isForeigner: effectiveForeigner }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }
      await onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <h2 className="text-[15px] font-black text-foreground">Редактирование гостя</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <label className="flex items-center gap-2 mb-4 text-[12px] font-semibold cursor-pointer">
            <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
            VIP-гость
          </label>
          <DocumentScanUpload
            guestId={guest.id}
            guestIsForeigner={effectiveForeigner}
            form={form}
            disabled={busy || scanBusy}
            onBusyChange={setScanBusy}
            onApplied={async ({ form: next, suggestedIsForeigner }) => {
              setForm(next);
              setEffectiveForeigner(suggestedIsForeigner);
              try {
                await fetch(`/api/guests/${guest.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ form: next, isForeigner: suggestedIsForeigner }),
                });
              } catch {
                /* ignore */
              }
              void refreshSilent();
            }}
          />
          <GuestFormFields form={form} setForm={setForm} isForeigner={effectiveForeigner} />
          {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground">Отмена</button>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
          >
            <Save size={14} /> {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
