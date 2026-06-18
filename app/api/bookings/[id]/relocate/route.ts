import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import { guestGenderMatchesDorm, setBedStatus } from "@/lib/dorm.server";
import { HK_CATEGORY_TYPES, hkTimeNow, formatHkPlaceLabel, startOfDay } from "@/lib/housekeeping";
import { mskDateKey } from "@/lib/msk-time";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { room: true, hotel: true, guest: { select: { gender: true } } },
  });
  if (!booking || booking.hotel.seatId !== session.seatId) {
    return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
  }

  const today = startOfDay(new Date());
  if (booking.status !== "checkedin" || booking.checkOut < today) {
    return NextResponse.json({ error: "Гость не проживает в отеле" }, { status: 400 });
  }

  const body = await req.json();
  const newRoomId = String(body.newRoomId ?? "").trim();
  const newBedIdIn = body.newBedId ? String(body.newBedId).trim() : null;

  if (!newRoomId) {
    return NextResponse.json({ error: "Выберите номер для переселения" }, { status: 400 });
  }

  const newRoom = await prisma.room.findFirst({
    where: { id: newRoomId, hotelId: booking.hotelId },
    include: { beds: true },
  });
  if (!newRoom) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  const oldRoomId = booking.roomId;
  const oldBedId = booking.bedId;
  const isSameRoom = newRoomId === oldRoomId;

  if (isSameRoom && newRoom.kind !== "dorm") {
    return NextResponse.json({ error: "Гость уже в этом номере" }, { status: 400 });
  }

  const checkInKey = mskDateKey(booking.checkIn);
  const checkOutKey = mskDateKey(booking.checkOut);

  const available = await findAvailableRooms({
    hotelId: booking.hotelId,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    guestGender: booking.guest?.gender ?? null,
    limit: 200,
  });

  let targetBedId: string | null = null;

  if (newRoom.kind === "dorm") {
    if (!guestGenderMatchesDorm(booking.guest?.gender, newRoom.dormGender)) {
      return NextResponse.json(
        { error: "Пол гостя не подходит для выбранной общей комнаты" },
        { status: 400 }
      );
    }

    const slotsInRoom = available.rooms.filter((s) => s.roomId === newRoomId && s.bedId);
    if (!slotsInRoom.length) {
      return NextResponse.json({ error: "Нет свободных койко-мест в этой комнате" }, { status: 400 });
    }

    if (newBedIdIn) {
      if (!slotsInRoom.some((s) => s.bedId === newBedIdIn)) {
        return NextResponse.json({ error: "Койко-место занято или недоступно" }, { status: 400 });
      }
      if (newBedIdIn === oldBedId) {
        return NextResponse.json({ error: "Гость уже на этой койке" }, { status: 400 });
      }
      targetBedId = newBedIdIn;
    } else {
      const pick = slotsInRoom.find((s) => s.bedId !== oldBedId);
      if (!pick?.bedId) {
        return NextResponse.json({ error: "Выберите свободную койку" }, { status: 400 });
      }
      targetBedId = pick.bedId;
    }

    const bed = newRoom.beds.find((b) => b.id === targetBedId);
    if (!bed) {
      return NextResponse.json({ error: "Койко-место не найдено" }, { status: 400 });
    }
    if (bed.status === "maintenance") {
      return NextResponse.json({ error: "Койко-место на ремонте" }, { status: 400 });
    }
  } else {
    if (newBedIdIn) {
      return NextResponse.json({ error: "Койко-место указывается только для общих комнат" }, { status: 400 });
    }
    if (isSameRoom) {
      return NextResponse.json({ error: "Гость уже в этом номере" }, { status: 400 });
    }
    if (!available.rooms.some((s) => s.roomId === newRoomId && !s.bedId)) {
      return NextResponse.json({ error: `Номер ${newRoom.number} занят на выбранные даты` }, { status: 400 });
    }
    if (newRoom.status === "maintenance") {
      return NextResponse.json({ error: `Номер ${newRoom.number} на ремонте` }, { status: 400 });
    }
  }

  const oldBed = oldBedId ? await prisma.bed.findUnique({ where: { id: oldBedId } }) : null;
  const newBed = targetBedId ? newRoom.beds.find((b) => b.id === targetBedId) : null;
  const oldRoomNumber = formatHkPlaceLabel(booking.room.number, oldBed?.label);
  const newPlaceLabel = newBed
    ? formatHkPlaceLabel(newRoom.number, newBed.label)
    : newRoom.number;

  const time = hkTimeNow();

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { roomId: newRoomId, bedId: targetBedId },
    }),
    prisma.hkTask.create({
      data: {
        hotelId: booking.hotelId,
        roomId: oldRoomId,
        bedId: oldBedId,
        bookingId: booking.id,
        roomNumber: oldRoomNumber,
        type: HK_CATEGORY_TYPES.relocation,
        category: "relocation",
        assignee: "—",
        priority: "high",
        status: "pending",
        time,
        est: "60 мин",
      },
    }),
  ]);

  if (oldBedId) {
    await setBedStatus(oldBedId, "cleaning");
  } else {
    await prisma.room.update({ where: { id: oldRoomId }, data: { status: "cleaning" } });
  }

  if (targetBedId) {
    await setBedStatus(targetBedId, "occupied");
  } else {
    await prisma.room.update({ where: { id: newRoomId }, data: { status: "occupied" } });
  }

  return NextResponse.json({
    ok: true,
    fromRoom: oldRoomNumber,
    toRoom: newPlaceLabel,
  });
}
