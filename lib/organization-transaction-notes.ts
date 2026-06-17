import { fmtDateRu } from "@/lib/format";

export function buildOrganizationPaymentNote(
  orgName: string,
  stayCheckIn: Date,
  stayCheckOut: Date,
  amount: number,
  paidBefore: number,
  stayAmount: number,
  userNote?: string | null
): string {
  const period = `${fmtDateRu(stayCheckIn)} — ${fmtDateRu(stayCheckOut)}`;
  const parts = [`Оплата проживания организации «${orgName}» за ${period}`];
  if (stayAmount > 0) {
    const after = paidBefore + amount;
    parts.push(`(${after.toLocaleString("ru-RU")} из ${stayAmount.toLocaleString("ru-RU")} ₽)`);
  }
  if (userNote?.trim()) parts.push(userNote.trim());
  return parts.join(". ");
}
