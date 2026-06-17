"use client";

import type { Channel } from "@/lib/types";

export function OtaChannelSelect({
  hotelId,
  channels,
  value,
  onChange,
}: {
  hotelId: string;
  channels: Channel[];
  value: string;
  onChange: (id: string) => void;
}) {
  const list = channels.filter((c) => c.hotelId === hotelId);

  if (!list.length) {
    return (
      <p className="text-[11px] text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2">
        Нет каналов для этого отеля. Создайте партнёра в разделе «Менеджер каналов (OTA)».
      </p>
    );
  }

  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground block mb-2">Канал OTA</label>
      <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
        {list.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => onChange(ch.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-[12px] font-semibold transition-all border-2"
            style={{
              borderColor: value === ch.id ? ch.color : "hsl(var(--border))",
              background: value === ch.id ? ch.color + "18" : undefined,
              color: value === ch.id ? ch.color : undefined,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: ch.color }}
            />
            {ch.name}
          </button>
        ))}
      </div>
    </div>
  );
}
