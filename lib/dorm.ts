import type { DormGender, RoomStatus } from "@/lib/types";

export function guestGenderMatchesDorm(
  guestGender: "M" | "F" | null | undefined,
  dormGender: DormGender | null | undefined
): boolean {
  if (!dormGender || dormGender === "mixed") return true;
  if (!guestGender) return false;
  if (dormGender === "male") return guestGender === "M";
  if (dormGender === "female") return guestGender === "F";
  return true;
}

export function formatBedDisplay(bedLabel: string): string {
  return bedLabel;
}

/** Подпись статуса койки для карточки в номерном фонде */
export function bedCardStatusLabel(status: RoomStatus, guestName: string | null): string {
  if (status === "cleaning") return "Уборка";
  if (status === "available") return "Свободен";
  if (guestName) return guestName;
  if (status === "maintenance") return "Ремонт";
  if (status === "checkout") return "Выезд";
  return "Занят";
}
