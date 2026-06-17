"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  guestName: string;
  onClose: () => void;
  onSubmit: (notifNumber: string) => Promise<void>;
}

export function MigRegModal({ guestName, onClose, onSubmit }: Props) {
  const [notifNumber, setNotifNumber] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(notifNumber.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-[15px] font-black text-foreground">Уведомление в МВД</h2>
            <p className="text-[11px] text-muted-foreground">{guestName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Подтвердите, что уведомление о прибытии иностранного гражданина направлено в МВД.
          </p>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Номер уведомления (необязательно)</label>
            <input
              value={notifNumber}
              onChange={(e) => setNotifNumber(e.target.value)}
              placeholder="№ уведомления"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">Отмена</button>
            <button type="submit" disabled={busy} className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "#059669" }}>
              {busy ? "Сохранение…" : "Подтвердить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
