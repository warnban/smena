import { prisma } from "@/lib/prisma";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import {
  buildDailyCloseReport,
  storedReportFromDb,
  type DailyPmBreakdown,
} from "@/lib/daily-report";
import { parseMskDateKey } from "@/lib/msk-time";

export async function loadHotelReportContext(hotelId: string, seatId: string) {
  const hotel = await prisma.hotel.findFirst({ where: { id: hotelId, seatId } });
  if (!hotel) return null;

  const [transactions, bookings, rooms, paymentMethods] = await Promise.all([
    prisma.transaction.findMany({ where: { hotelId }, orderBy: { date: "desc" } }),
    prisma.booking.findMany({ where: { hotelId } }),
    prisma.room.findMany({ where: { hotelId } }),
    ensurePaymentMethods(seatId),
  ]);

  return { hotel, transactions, bookings, rooms, paymentMethods };
}

export async function getShiftForDate(hotelId: string, dateKey: string) {
  return prisma.dailyShiftLog.findUnique({
    where: { hotelId_date: { hotelId, date: parseMskDateKey(dateKey) } },
  });
}

export async function buildPreviewReport(
  hotelId: string,
  seatId: string,
  dateKey: string
) {
  const ctx = await loadHotelReportContext(hotelId, seatId);
  if (!ctx) return null;

  const shift = await getShiftForDate(hotelId, dateKey);

  const data = buildDailyCloseReport(
    ctx.transactions,
    ctx.bookings,
    ctx.rooms,
    dateKey,
    ctx.paymentMethods,
    shift ?? { dayAdminName: "", nightAdminName: "" }
  );

  return { preview: true as const, date: dateKey, ...data };
}

export async function closeDailyReport(
  hotelId: string,
  seatId: string,
  dateKey: string,
  closedByUserId?: string
) {
  const existing = await prisma.dailyReport.findUnique({
    where: { hotelId_date: { hotelId, date: parseMskDateKey(dateKey) } },
  });
  if (existing) return { ok: false as const, error: "Отчёт за эту дату уже закрыт" };

  const preview = await buildPreviewReport(hotelId, seatId, dateKey);
  if (!preview) return { ok: false as const, error: "Отель не найден" };

  const row = await prisma.dailyReport.create({
    data: {
      hotelId,
      date: parseMskDateKey(dateKey),
      dayAdminName: preview.dayAdminName,
      nightAdminName: preview.nightAdminName,
      occupancy: preview.occupancy,
      cashOpening: preview.cashOpening,
      cashClosing: preview.cashClosing,
      accommodationTotal: preview.accommodationTotal,
      grandTotal: preview.grandTotal,
      expensesTotal: preview.expensesTotal,
      encashmentTotal: preview.encashmentTotal,
      byPayment: preview.byPayment as DailyPmBreakdown[],
      closedByUserId: closedByUserId ?? null,
    },
  });

  return { ok: true as const, report: storedReportFromDb(row) };
}

export async function reopenDailyReport(hotelId: string, seatId: string, dateKey: string) {
  const existing = await prisma.dailyReport.findUnique({
    where: { hotelId_date: { hotelId, date: parseMskDateKey(dateKey) } },
  });
  if (!existing) return { ok: false as const, error: "Отчёт за эту дату не закрыт" };

  await prisma.dailyReport.delete({ where: { id: existing.id } });

  const preview = await buildPreviewReport(hotelId, seatId, dateKey);
  if (!preview) return { ok: false as const, error: "Отель не найден" };

  return { ok: true as const, report: preview };
}
