"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { mskDateKey } from "@/lib/msk-time";

export function OperationDateField({
  value,
  onChange,
  enabled,
}: {
  value: string;
  onChange: (value: string) => void;
  enabled: boolean;
}) {
  if (!enabled) return null;

  const today = mskDateKey();

  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground block mb-1">Дата операции</label>
      <DatePicker
        mode="iso"
        value={value || today}
        onChange={onChange}
        max={today}
        placeholder="Дата проведения"
        className="w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl"
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        Для внесения операций задним числом при сверке данных
      </p>
    </div>
  );
}
