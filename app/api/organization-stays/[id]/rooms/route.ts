import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import {
  assertRoomAvailable,
  parseStayDate,
  recalcOrganizationStayAmount,
  shouldOccupyRoom,
} from "@/lib/organization-stay";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const stay = await prisma.organizationStay.findUnique({
      where: { id: params.id },
      include: { organization: true },
    });
    if (!stay || stay.organization.seatId !== session?.seatId) {
      return NextResponse.json({ error: "Проживание не найдено" }, { status: 404 });
    }
    if (stay.status !== "active") {
      return NextResponse.json({ error: "Проживание не активно" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, stay.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const roomId = String(body.roomId ?? "");
    const checkIn = parseStayDate(body.checkIn ?? stay.checkIn);
    const checkOut = parseStayDate(body.checkOut ?? stay.checkOut);

    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "Дата выезда должна быть позже заезда" }, { status: 400 });
    }
    if (checkIn < stay.checkIn || checkOut > stay.checkOut) {
      return NextResponse.json({ error: "Период номера должен быть в рамках проживания. Продлите проживание при необходимости." }, { status: 400 });
    }

    const avail = await assertRoomAvailable(roomId, checkIn, checkOut);
    if (!avail.ok) return NextResponse.json({ error: avail.error }, { status: 400 });

    const room = await prisma.room.findFirst({ where: { id: roomId, hotelId: stay.hotelId } });
    if (!room) return NextResponse.json({ error: "Номер не найден" }, { status: 404 });

    const stayRoom = await prisma.$transaction(async (tx) => {
      const sr = await tx.organizationStayRoom.create({
        data: {
          organizationStayId: stay.id,
          roomId: room.id,
          roomNumber: room.number,
          checkIn,
          checkOut,
          status: "active",
        },
      });

      if (shouldOccupyRoom(checkIn)) {
        await tx.room.update({ where: { id: room.id }, data: { status: "occupied" } });
      }

      return sr;
    });

    await recalcOrganizationStayAmount(stay.id);

    return NextResponse.json({ ok: true, room: stayRoom });
  } catch (e) {
    console.error("[organization-stays rooms POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось добавить номер") }, { status: 500 });
  }
}
