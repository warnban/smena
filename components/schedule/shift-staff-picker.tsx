"use client";

import { useMemo } from "react";
import { UserPlus, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { inits } from "@/lib/format";
import { SHIFT_ROLE_COLORS, type ShiftRole } from "@/lib/schedule-salary";
import type { StaffMember } from "@/lib/types";

export function ShiftStaffPicker({
  role,
  staff,
  candidates,
  onSelect,
  onClear,
}: {
  role: ShiftRole;
  staff?: StaffMember;
  candidates: StaffMember[];
  onSelect: (staffId: string) => void;
  onClear: () => void;
}) {
  const colors = SHIFT_ROLE_COLORS[role];
  const options = useMemo(
    () =>
      candidates.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [candidates]
  );

  if (staff) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-xl font-bold text-[12px]"
        style={{ background: colors.bg, color: colors.text, border: `2px solid ${colors.text}` }}
      >
        <StaffBubble person={staff} colors={colors} />
        <span className="flex-1 truncate min-w-0">{staff.name}</span>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-lg hover:bg-black/10 flex-shrink-0"
          aria-label="Снять смену"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div
        className="px-3 py-2.5 rounded-xl text-[11px] font-medium text-center border-2 border-dashed text-muted-foreground"
        style={{ borderColor: colors.border }}
      >
        Нет доступных сотрудников
      </div>
    );
  }

  return (
    <Select
      value=""
      onChange={onSelect}
      placeholder="Назначить сотрудника"
      options={options}
      className="[&>button]:border-dashed [&>button]:py-2.5"
    />
  );
}

export function ShiftStaffChip({
  person,
  role,
  selected,
  onClick,
}: {
  person: StaffMember;
  role: ShiftRole;
  selected: boolean;
  onClick: () => void;
}) {
  const colors = SHIFT_ROLE_COLORS[role];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all text-[11px] font-semibold"
      style={{
        background: selected ? colors.bg : "transparent",
        color: selected ? colors.text : undefined,
        border: `1.5px solid ${selected ? colors.text : "hsl(var(--border))"}`,
        opacity: selected ? 1 : 0.7,
      }}
    >
      <StaffBubble person={person} colors={colors} size={24} />
      <span className="flex-1 truncate">{person.name}</span>
      <span className="text-[10px] font-bold w-4 text-center">{selected ? "✓" : ""}</span>
    </button>
  );
}

function StaffBubble({
  person,
  colors,
  size = 26,
}: {
  person: StaffMember;
  colors: { bg: string; text: string };
  size?: number;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: colors.bg,
        color: colors.text,
        border: `1.5px solid ${colors.text}40`,
      }}
    >
      {person.initials || inits(person.name)}
    </div>
  );
}

export function EmptyShiftHint({ role }: { role: ShiftRole }) {
  const colors = SHIFT_ROLE_COLORS[role];
  return (
    <div
      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium border-2 border-dashed"
      style={{ borderColor: colors.border, color: colors.text, opacity: 0.55 }}
    >
      <UserPlus size={13} />
      Не назначен
    </div>
  );
}
