"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Organization } from "@/lib/types";

export function OrganizationFormModal({
  org,
  onClose,
  onSaved,
}: {
  org?: Organization | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(org?.name ?? "");
  const [inn, setInn] = useState(org?.inn ?? "");
  const [contactPerson, setContactPerson] = useState(org?.contactPerson ?? "");
  const [phone, setPhone] = useState(org?.phone ?? "");
  const [email, setEmail] = useState(org?.email ?? "");
  const [notes, setNotes] = useState(org?.notes ?? "");
  const [skipWeeklyCleaning, setSkipWeeklyCleaning] = useState(org?.skipWeeklyCleaning ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setInn(org.inn);
      setContactPerson(org.contactPerson);
      setPhone(org.phone);
      setEmail(org.email);
      setNotes(org.notes);
      setSkipWeeklyCleaning(org.skipWeeklyCleaning);
    }
  }, [org]);

  async function submit() {
    if (!name.trim()) {
      setError("Укажите название");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      name: name.trim(),
      inn: inn.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      skipWeeklyCleaning,
    };
    const res = await fetch(org ? `/api/organizations/${org.id}` : "/api/organizations", {
      method: org ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка сохранения");
      setBusy(false);
      return;
    }
    await onSaved();
    onClose();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold text-foreground">
            {org ? "Редактировать организацию" : "Новая организация"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Название *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">ИНН</label>
              <input value={inn} onChange={(e) => setInn(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Контактное лицо</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Комментарий</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none resize-none" />
          </div>
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-muted/40 cursor-pointer">
            <input type="checkbox" checked={skipWeeklyCleaning} onChange={(e) => setSkipWeeklyCleaning(e.target.checked)} className="mt-0.5 rounded" />
            <div>
              <div className="text-[13px] font-semibold text-foreground">Без плановой уборки</div>
              <div className="text-[11px] text-muted-foreground">Номера не попадают на уборку раз в 7 дней — только при выселении</div>
            </div>
          </label>
          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-[13px] font-semibold rounded-xl bg-muted">Отмена</button>
          <button type="button" onClick={submit} disabled={busy} className="flex-1 py-2.5 text-[13px] font-bold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50">
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
