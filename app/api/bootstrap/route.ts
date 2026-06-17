import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import { ensureRoomCategories } from "@/lib/ensure-room-categories";
import { syncScheduledCleaning } from "@/lib/housekeeping";
import { canWriteHotelOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seatId = session.seatId;

  // Доступные отели
  let hotelIds: string[];
  if (session.role === "owner") {
    const hotels = await prisma.hotel.findMany({ where: { seatId }, select: { id: true } });
    hotelIds = hotels.map((h) => h.id);
  } else {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId },
      include: { hotels: true },
    });
    hotelIds = staff?.hotels.map((h) => h.hotelId) ?? [];
  }

  const hotelFilter = { seatId, ...(hotelIds.length ? { id: { in: hotelIds } } : { id: "__none__" }) };

  const paymentMethods = await ensurePaymentMethods(seatId);
  const roomCategories = await ensureRoomCategories(seatId);

  if (hotelIds.length) {
    try {
      await syncScheduledCleaning(prisma, hotelIds);
    } catch (e) {
      console.error("[bootstrap] syncScheduledCleaning", e);
    }
  }

  const [seat, hotels, staff, rooms, beds, guests, organizations, organizationStays, bookings, transactions, catalogItems, hkTasks, channels, hotelDiscountRules, transactionCategories] = await Promise.all([
    prisma.seat.findUnique({ where: { id: seatId }, select: { id: true, name: true } }),
    prisma.hotel.findMany({ where: hotelFilter, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { seatId }, include: { hotels: true } }),
    prisma.room.findMany({
      where: { hotel: hotelFilter },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
    prisma.bed.findMany({
      where: { hotel: hotelFilter },
      orderBy: [{ roomId: "asc" }, { label: "asc" }],
    }),
    prisma.guest.findMany({
      where: { seatId },
      include: { documents: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findMany({
      where: { seatId },
      include: { documents: { orderBy: { uploadedAt: "desc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.organizationStay.findMany({
      where: { hotel: hotelFilter },
      include: { rooms: true },
      orderBy: { checkIn: "desc" },
    }),
    prisma.booking.findMany({
      where: { hotel: hotelFilter },
      orderBy: { checkIn: "asc" },
    }),
    prisma.transaction.findMany({
      where: { hotel: hotelFilter },
      orderBy: { date: "desc" },
    }),
    prisma.service.findMany({
      where: { seatId, active: true },
      orderBy: [{ kind: "asc" }, { price: "asc" }],
    }),
    prisma.hkTask.findMany({
      where: { hotel: hotelFilter },
      orderBy: [{ status: "asc" }, { time: "asc" }],
    }),
    prisma.channel.findMany({
      where: { hotel: hotelFilter },
      orderBy: { name: "asc" },
    }),
    prisma.hotelDiscountRule.findMany({
      where: { hotel: hotelFilter },
      orderBy: [{ minNights: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.transactionCategoryDef.findMany({
      where: { seatId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const staffShaped = staff.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.name,
    role: s.role,
    position: s.position,
    initials: s.initials,
    hotelIds: s.hotels.map((h) => h.hotelId),
    hasAccount: Boolean(s.userId),
    dayShiftRate: s.dayShiftRate,
    nightShiftRate: s.nightShiftRate,
    hkShiftRate: s.hkShiftRate,
  }));

  const currentStaff =
    staffShaped.find((s) => s.userId === session.userId) ??
    (session.role === "owner" ? staffShaped.find((s) => s.role === "owner") ?? null : null);

  const services = catalogItems.filter((c) => c.kind === "service");
  const expenses = catalogItems.filter((c) => c.kind === "expense");

  return NextResponse.json({
    seat,
    session: { userId: session.userId, role: session.role, email: session.email },
    hotels,
    staff: staffShaped,
    currentUser: currentStaff,
    rooms,
    beds,
    guests,
    organizations,
    organizationStays,
    bookings,
    transactions,
    services,
    expenses,
    paymentMethods,
    roomCategories,
    hkTasks,
    channels,
    hotelDiscountRules,
    transactionCategories,
    canViewAllHotels: session.role === "owner" || (currentStaff?.hotelIds.length ?? 0) > 1,
    canManageSettings: session.role === "owner" || session.role === "manager",
    canWriteHotelOps: canWriteHotelOps(session.role),
  });
  } catch (e) {
    console.error("[bootstrap]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось загрузить данные") }, { status: 500 });
  }
}
