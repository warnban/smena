"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";

const inp =
  "w-full min-h-[280px] px-3 py-2.5 text-[13px] rounded-xl border border-border bg-card outline-none focus:ring-1 focus:ring-ring font-mono leading-relaxed disabled:opacity-60";

export function NetworkFaqEditor({ canEdit }: { canEdit: boolean }) {
  const [content, setContent] = useState("");
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!canEdit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/faq");
      if (!res.ok) return;
      const data = await res.json();
      setContent(data.content ?? "");
      const parts: string[] = [];
      if (data.updatedAt) {
        parts.push(`Обновлено: ${new Date(data.updatedAt).toLocaleString("ru-RU")}`);
      }
      if (data.updatedBy) parts.push(data.updatedBy);
      if (data.chunkCount != null) parts.push(`${data.chunkCount} фрагм. для поиска`);
      setMeta(parts.join(" · "));
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/faq", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Ошибка сохранения");
        return;
      }
      setMsg("Сохранено");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <p className="text-[13px] text-muted-foreground">
        FAQ сети редактируют владелец или управляющий.
      </p>
    );
  }

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Загрузка FAQ…</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-[14px] font-bold text-foreground">FAQ для AI-помощника</h3>
        <p className="text-[12px] text-muted-foreground mt-1">
          Один документ на всю сеть. Разделы — через заголовки <code className="text-[11px]">## Название</code>.
          Пока пусто — помощник сообщит, что FAQ не заполнен.
        </p>
      </div>

      <textarea
        className={inp}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`## Заселение\nИнструкция для админов...\n\n## Оплата\nПравила оплаты...`}
        disabled={busy}
      />

      {meta && <p className="text-[11px] text-muted-foreground">{meta}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 text-white text-[12px] font-bold rounded-lg disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
        >
          <Save size={14} />
          {busy ? "Сохранение…" : "Сохранить FAQ"}
        </button>
        {msg && (
          <span className={`text-[12px] font-semibold ${msg === "Сохранено" ? "text-success" : "text-destructive"}`}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
