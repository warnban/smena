import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import type { DormGender, RoomStatus } from "@prisma/client";
import { isValidCategoryCode } from "@/lib/ensure-room-categories";
import { syncDormRoomStatus } from "@/lib/dorm.server";
import { assertBedNumbersAvailable } from "@/lib/bed-numbers.server";

const STATUSES: RoomStatus[] = ["available", "occupied", "checkin", "checkout", "cleaning", "maintenance"];
const DORM_GENDERS: DormGender[] = ["male", "female", "mixed"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: { hotel: true, beds: true },
  });
  if (!room || room.hotel.seatId !== session?.seatId) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  const check = await assertHotelWrite(session, room.hotelId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const { number, category, floor, status, price, amenities, dormGender, addBedNumbers, addBeds, bedCount } = body as {
    number?: string;
    category?: string;
    floor?: number;
    status?: RoomStatus;
    price?: number;
    amenities?: string[];
    dormGender?: DormGender;
    addBedNumbers?: string[];
    addBeds?: number;
    bedCount?: number;
  };

  if (number !== undefined) {
    const trimmed = String(number).trim();
    if (!trimmed) return NextResponse.json({ error: "Номер комнаты не может быть пустым" }, { status: 400 });
    const duplicate = await prisma.room.findFirst({
      where: { hotelId: room.hotelId, number: trimmed, NOT: { id: room.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Номер с таким названием уже существует" }, { status: 409 });
    }
  }

  let categoryUpdate: string | undefined;
  if (category !== undefined) {
    const valid = await isValidCategoryCode(session!.seatId!, category);
    if (!valid) {
      return NextResponse.json({ error: "Неизвестная категория номера" }, { status: 400 });
    }
    categoryUpdate = category;
  }

  if (room.kind === "dorm" && dormGender !== undefined && !DORM_GENDERS.includes(dormGender)) {
    return NextResponse.json({ error: "Некорректный тип общей комнаты" }, { status: 400 });
  }

  let bedsToAdd: string[] = [];
  if (room.kind === "dorm" && Array.isArray(addBedNumbers) && addBedNumbers.length) {
    const check = await assertBedNumbersAvailable(prisma, room.hotelId, addBedNumbers);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    bedsToAdd = check.numbers;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.room.update({
      where: { id: room.id },
      data: {
        ...(number !== undefined ? { number: String(number).trim() } : {}),
        ...(categoryUpdate !== undefined ? { category: categoryUpdate } : {}),
        ...(floor !== undefined ? { floor: Math.max(1, Math.round(Number(floor) || 1)) } : {}),
        ...(status !== undefined && STATUSES.includes(status) ? { status } : {}),
        ...(price !== undefined ? { price: Math.max(0, Math.round(Number(price) || 0)) } : {}),
        ...(amenities !== undefined ? { amenities: Array.isArray(amenities) ? amenities.map(String) : [] } : {}),
        ...(room.kind === "dorm" && dormGender !== undefined ? { dormGender } : {}),
      },
    });

    if (bedsToAdd.length) {
      await tx.bed.createMany({
        data: bedsToAdd.map((label) => ({
          roomId: room.id,
          hotelId: room.hotelId,
          label,
          status: "available" as RoomStatus,
        })),
      });
    }

    return tx.room.findUnique({
      where: { id: row.id },
      include: { beds: { orderBy: { label: "asc" } } },
    });
  });

  if (updated?.kind === "dorm") {
    await syncDormRoomStatus(updated.id);
  }

  return NextResponse.json({ ok: true, room: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const room = await prisma.room.findUnique({
    where: { id: params.id },
    include: { hotel: true, bookings: { where: { status: { notIn: ["checkedout", "cancelled"] } }, take: 1 } },
  });
  if (!room || room.hotel.seatId !== session?.seatId) {
    return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
  }

  const check = await assertHotelWrite(session, room.hotelId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  if (room.bookings.length > 0) {
    return NextResponse.json({ error: "Нельзя удалить номер с активными бронированиями" }, { status: 409 });
  }

  await prisma.room.delete({ where: { id: room.id } });
  return NextResponse.json({ ok: true });
}
