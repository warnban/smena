import type { Booking, Transaction } from "@/lib/types";

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Все транзакции гостя: по bookingId и по совпадению ФИО. */
export function filterGuestTransactions(
  guestId: string,
  guestName: string,
  bookings: Booking[],
  transactions: Transaction[]
): Transaction[] {
  const bookingIds = new Set(
    bookings.filter((b) => b.guestId === guestId).map((b) => b.id)
  );
  const nameKey = normName(guestName);

  return transactions
    .filter((t) => {
      if (t.bookingId && bookingIds.has(t.bookingId)) return true;
      if (t.guestName && normName(t.guestName) === nameKey) return true;
      return false;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Транзакции одного бронирования. */
export function filterBookingTransactions(
  bookingId: string,
  transactions: Transaction[]
): Transaction[] {
  return transactions
    .filter((t) => t.bookingId === bookingId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function txTypeLabel(t: Transaction): string {
  if (t.type === "encashment") return "Инкассация";
  if (t.type === "expense") return "Расход";
  if (t.type === "service") return "Услуга";
  if (t.type === "refund") return "Возврат";
  return "Оплата";
}
