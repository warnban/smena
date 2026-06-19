import type { Bed, Booking, Room, Transaction } from "@/lib/types";
import type { PaymentMethodDef } from "@/lib/payment-methods";
import { buildDailyCloseReport, type DailyPmBreakdown } from "@/lib/daily-report";
import { calcCashBalance } from "@/lib/finance";
import { filterPaymentDueBookings, paymentDueInfo } from "@/lib/booking-payment-due";
import { mskDateKey } from "@/lib/msk-time";

export type UnpaidGuestRow = {
  bookingId: string;
  guestName: string;
  roomNumber: string;
  amount: number;
  paid: number;
  debt: number;
  debtNights: number;
};

export type ShiftHandoverData = {
  dateKey: string;
  cashBalance: number;
  byPayment: DailyPmBreakdown[];
  accommodationTotal: number;
  grandTotal: number;
  unpaidGuests: UnpaidGuestRow[];
};

export function buildShiftHandover(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  paymentMethods: PaymentMethodDef[],
  hotelId: string,
  dateKey = mskDateKey(),
  beds: Bed[] = []
): ShiftHandoverData {
  const hotelTx = transactions.filter((t) => t.hotelId === hotelId);
  const hotelBookings = bookings.filter((b) => b.hotelId === hotelId);
  const hotelRooms = rooms.filter((r) => r.hotelId === hotelId);
  const hotelBeds = beds.filter((b) => b.hotelId === hotelId);

  const todayReport = buildDailyCloseReport(
    hotelTx,
    hotelBookings,
    hotelRooms,
    dateKey,
    paymentMethods,
    undefined,
    hotelBeds
  );

  const unpaidGuests = filterPaymentDueBookings(hotelBookings, dateKey)
    .map((b) => {
      const { debt, debtNights } = paymentDueInfo(b, dateKey);
      return {
        bookingId: b.id,
        guestName: b.guestName,
        roomNumber: hotelRooms.find((r) => r.id === b.roomId)?.number ?? "—",
        amount: b.amount,
        paid: b.paid,
        debt,
        debtNights,
      };
    })
    .sort((a, b) => b.debt - a.debt);

  return {
    dateKey,
    cashBalance: calcCashBalance(hotelTx, hotelBookings),
    byPayment: todayReport.byPayment,
    accommodationTotal: todayReport.accommodationTotal,
    grandTotal: todayReport.grandTotal,
    unpaidGuests,
  };
}
