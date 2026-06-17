import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import type { DormGender, RoomKind, RoomStatus } from "@prisma/client";
import { defaultCategoryCode, isValidCategoryCode } from "@/lib/ensure-room-categories";
import { assertBedNumbersAvailable } from "@/lib/bed-numbers.server";

const STATUSES: RoomStatus[] = ["available", "occupied", "checkin", "checkout", "cleaning", "maintenance"];
const KINDS: RoomKind[] = ["private", "dorm"];
const DORM_GENDERS: DormGender[] = ["male", "female", "mixed"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const {
    hotelId,
    number,
    kind = "private",
    dormGender,
    bedNumbers,
    bedCount = 0,
    category,
    floor = 1,
    status = "available",
    price = 0,
    amenities = [],
  } = body as {
    hotelId?: string;
    number?: string;
    kind?: RoomKind;
    dormGender?: DormGender | null;
    bedNumbers?: string[];
    bedCount?: number;
    category?: string;
    floor?: number;
    status?: RoomStatus;
    price?: number;
    amenities?: string[];
  };

  if (!hotelId || !number?.trim()) {
    return NextResponse.json({ error: "Укажите отель и номер комнаты" }, { status: 400 });
  }

  const check = await assertHotelWrite(session, hotelId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const roomKind = KINDS.includes(kind) ? kind : "private";

  let bedLabels: string[] = [];
  if (roomKind === "dorm") {
    if (!dormGender || !DORM_GENDERS.includes(dormGender)) {
      return NextResponse.json({ error: "Для общей комнаты укажите тип: male, female или mixed" }, { status: 400 });
    }
    if (Array.isArray(bedNumbers) && bedNumbers.length) {
      const check = await assertBedNumbersAvailable(prisma, hotelId, bedNumbers);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      bedLabels = check.numbers;
    } else {
      const bedsN = Math.max(0, Math.round(Number(bedCount) || 0));
      if (bedsN < 1) {
        return NextResponse.json({ error: "Укажите номера койко-мест" }, { status: 400 });
      }
      return NextResponse.json({ error: "Укажите номера койко-мест (каждая койка — свой номер в отеле)" }, { status: 400 });
    }
  }

  const seatId = session!.seatId!;
  const cat =
    category && (await isValidCategoryCode(seatId, category))
      ? category
      : await defaultCategoryCode(seatId);
  const st = STATUSES.includes(status) ? status : "available";

  const duplicate = await prisma.room.findFirst({
    where: { hotelId, number: number.trim() },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Номер с таким названием уже существует" }, { status: 409 });
  }

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.room.create({
      data: {
        hotelId,
        number: number.trim(),
        kind: roomKind,
        dormGender: roomKind === "dorm" ? dormGender! : null,
        category: cat,
        floor: Math.max(1, Math.round(Number(floor) || 1)),
        status: st,
        price: Math.max(0, Math.round(Number(price) || 0)),
        amenities: Array.isArray(amenities) ? amenities.map(String) : [],
      },
    });

    if (roomKind === "dorm") {
      await tx.bed.createMany({
        data: bedLabels.map((label) => ({
          roomId: created.id,
          hotelId,
          label,
          status: "available" as RoomStatus,
        })),
      });
    }

    return tx.room.findUnique({
      where: { id: created.id },
      include: { beds: { orderBy: { label: "asc" } } },
    });
  });

  return NextResponse.json({ ok: true, room });
}
