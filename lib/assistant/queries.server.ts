import "server-only";

import { prisma } from "@/lib/prisma";
import {
  filterPaymentDueBookings,
  filterPaymentDueSoonBookings,
  paymentDueInfo,
  paymentSoonInfo,
} from "@/lib/booking-payment-due";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import { formatDormPlaceLabel } from "@/lib/dorm";
import { fmtDate } from "@/lib/format";
import { mskDateKey, mskAddDays } from "@/lib/msk-time";
import type { SessionPayload } from "@/lib/auth";

export async function getMorningBriefing(session: SessionPayload, hotelId: string) {
  const todayKey = mskDateKey();
  const tomorrowKey = mskAddDays(todayKey, 1);

  const [arrivals, departures, checkedIn, hkPending, txs] = await Promise.all([
    prisma.booking.findMany({
      where: {
        hotelId,
        hotel: { seatId: session.seatId! },
        status: { in: ["new", "confirmed"] },
        checkIn: { lte: new Date(tomorrowKey + "T23:59:59") },
      },
      include: { room: true },
      orderBy: { checkIn: "asc" },
      take: 15,
    }),
    prisma.booking.findMany({
      where: {
        hotelId,
        hotel: { seatId: session.seatId! },
        status: "checkedin",
        checkOut: { lte: new Date(tomorrowKey + "T23:59:59") },
      },
      include: { room: true },
      orderBy: { checkOut: "asc" },
      take: 15,
    }),
    prisma.booking.findMany({
      where: { hotelId, status: "checkedin" },
      include: { room: true },
    }),
    prisma.hkTask.findMany({
      where: { hotelId, status: { in: ["pending", "in_progress"] } },
      orderBy: { time: "asc" },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { hotelId, cancelledAt: null },
    }),
  ]);

  const dueToday = filterPaymentDueBookings(checkedIn, todayKey, txs);
  const dueSoon = filterPaymentDueSoonBookings(checkedIn, todayKey, txs);
  const byId = new Map(checkedIn.map((b) => [b.id, b]));

  return {
    today: todayKey,
    arrivals: arrivals.map((b) => ({
      bookingId: b.id,
      guestName: b.guestName,
      roomNumber: b.room.number,
      checkIn: fmtDate(b.checkIn),
      status: b.status,
    })),
    departures: departures.map((b) => ({
      bookingId: b.id,
      guestName: b.guestName,
      roomNumber: b.room.number,
      checkOut: fmtDate(b.checkOut),
    })),
    paymentDueToday: dueToday.map((b) => {
      const info = paymentDueInfo(b, todayKey, txs);
      const full = byId.get(b.id);
      return {
        bookingId: b.id,
        guestName: b.guestName,
        roomNumber: full?.room.number ?? "—",
        debt: info.debt,
      };
    }),
    paymentDueSoon: dueSoon.slice(0, 5).map((b) => {
      const info = paymentSoonInfo(b, todayKey, txs);
      const full = byId.get(b.id);
      return {
        bookingId: b.id,
        guestName: b.guestName,
        roomNumber: full?.room.number ?? "—",
        paidThrough: info.paidThroughKey,
      };
    }),
    hkPending: hkPending.map((t) => ({
      taskId: t.id,
      roomNumber: t.roomNumber,
      type: t.type,
      status: t.status,
    })),
    occupiedCount: checkedIn.length,
  };
}

export async function listTodayArrivals(session: SessionPayload, hotelId: string) {
  const todayKey = mskDateKey();
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      hotel: { seatId: session.seatId! },
      status: { in: ["new", "confirmed", "checkedin"] },
      checkIn: { lte: new Date(todayKey + "T23:59:59") },
      checkOut: { gt: new Date(todayKey) },
    },
    include: { room: true },
    orderBy: { checkIn: "asc" },
    take: 20,
  });
  return bookings.map((b) => ({
    bookingId: b.id,
    guestName: b.guestName,
    roomNumber: b.room.number,
    status: b.status,
    checkIn: fmtDate(b.checkIn),
    checkOut: fmtDate(b.checkOut),
  }));
}

export async function listTodayDepartures(session: SessionPayload, hotelId: string) {
  const todayKey = mskDateKey();
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      hotel: { seatId: session.seatId! },
      status: "checkedin",
      checkOut: { lte: new Date(todayKey + "T23:59:59") },
    },
    include: { room: true },
    orderBy: { checkOut: "asc" },
    take: 20,
  });
  return bookings.map((b) => ({
    bookingId: b.id,
    guestName: b.guestName,
    roomNumber: b.room.number,
    checkOut: fmtDate(b.checkOut),
  }));
}

export async function whoInRoom(session: SessionPayload, hotelId: string, roomQuery: string) {
  const q = roomQuery.trim();
  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      hotel: { seatId: session.seatId! },
      status: "checkedin",
      room: { number: { contains: q, mode: "insensitive" } },
    },
    include: { room: true, guest: true },
    take: 10,
  });
  return bookings.map((b) => ({
    bookingId: b.id,
    guestName: b.guestName,
    roomNumber: b.room.number,
    checkOut: fmtDate(b.checkOut),
    isForeigner: b.guest?.isForeigner ?? false,
  }));
}

export async function listFreeRoomsNow(session: SessionPayload, hotelId: string, nights = 1) {
  const checkIn = mskDateKey();
  const checkOut = mskAddDays(checkIn, nights);
  const { rooms } = await findAvailableRooms({
    hotelId,
    checkIn,
    checkOut,
    limit: 15,
  });
  return {
    checkIn,
    checkOut,
    nights,
    rooms: rooms.map((r) => ({
      placeId: r.id,
      roomId: r.roomId,
      bedId: r.bedId,
      kind: r.kind,
      placeLabel:
        r.kind === "dorm" ? formatDormPlaceLabel(r.roomLabel, r.bedLabel ?? r.number) : r.roomLabel,
      category: r.category,
      pricePerNight: r.price,
    })),
  };
}

export async function listHkTasks(session: SessionPayload, hotelId: string) {
  const tasks = await prisma.hkTask.findMany({
    where: { hotelId, hotel: { seatId: session.seatId! }, status: { in: ["pending", "in_progress"] } },
    orderBy: [{ priority: "desc" }, { time: "asc" }],
    take: 20,
  });
  return tasks.map((t) => ({
    taskId: t.id,
    roomNumber: t.roomNumber,
    type: t.type,
    status: t.status,
    assignee: t.assignee,
    priority: t.priority,
  }));
}

export async function listActiveServices(session: SessionPayload) {
  const items = await prisma.service.findMany({
    where: { seatId: session.seatId!, active: true, kind: "service" },
    orderBy: [{ name: "asc" }],
    take: 30,
  });
  return items.map((s) => ({
    serviceId: s.id,
    name: s.name,
    price: s.price,
    category: s.category,
  }));
}

export function buildMorningBriefingText(
  briefing: Awaited<ReturnType<typeof getMorningBriefing>>,
  hotelName: string | null
): string {
  const lines: string[] = [
    `🐹 Привет, хомячок! ${hotelName ? `Отель «${hotelName}».` : ""} Вот что сегодня:`,
  ];
  if (briefing.arrivals.length) {
    lines.push(`\n📥 Заезды (${briefing.arrivals.length}):`);
    for (const a of briefing.arrivals.slice(0, 5)) {
      lines.push(`  • ${a.guestName}, №${a.roomNumber} — ${a.checkIn}`);
    }
  } else {
    lines.push("\n📥 Заездов сегодня нет.");
  }
  if (briefing.departures.length) {
    lines.push(`\n📤 Выезды (${briefing.departures.length}):`);
    for (const d of briefing.departures.slice(0, 5)) {
      lines.push(`  • ${d.guestName}, №${d.roomNumber} — до ${d.checkOut}`);
    }
  }
  if (briefing.paymentDueToday.length) {
    lines.push(`\n💰 Нужна оплата сегодня (${briefing.paymentDueToday.length}):`);
    for (const p of briefing.paymentDueToday.slice(0, 5)) {
      lines.push(`  • ${p.guestName}, №${p.roomNumber} — ${p.debt} ₽`);
    }
  }
  if (briefing.hkPending.length) {
    lines.push(`\n✨ Уборок в работе: ${briefing.hkPending.length}`);
  }
  lines.push("\nЧем займёмся? Жми кнопку или напиши 👇");
  return lines.join("");
}

export function buildPrintFormUrls(guestId: string, bookingId: string): Array<{ label: string; url: string; formId: string }> {
  const base = `/guests/form-print?guestId=${encodeURIComponent(guestId)}&bookingId=${encodeURIComponent(bookingId)}&print=1`;
  return [
    { formId: "pd-consent", label: "Согласие на ПДн", url: `${base}&formId=pd-consent` },
    { formId: "hotel-rules", label: "Правила проживания", url: `${base}&formId=hotel-rules` },
    { formId: "hotel-contract", label: "Договор", url: `${base}&formId=hotel-contract` },
  ];
}
