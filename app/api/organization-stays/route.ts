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
import {
  occupyOrganizationRoom,
  syncOrganizationDormRooms,
} from "@/lib/organization-stay-occupancy.server";

type RoomInput = { roomId: string; checkIn?: string; checkOut?: string };

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();

    const hotelId = String(body.hotelId ?? "");
    const organizationId = String(body.organizationId ?? "");
    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const org = await prisma.organization.findFirst({
      where: { id: organizationId, seatId: auth.session.seatId },
    });
    if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

    const checkIn = parseStayDate(body.checkIn);
    const checkOut = parseStayDate(body.checkOut);
    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "Дата выезда должна быть позже заезда" }, { status: 400 });
    }

    const roomInputs: RoomInput[] = Array.isArray(body.rooms) ? body.rooms : [];

    for (const ri of roomInputs) {
      const riIn = ri.checkIn ? parseStayDate(ri.checkIn) : checkIn;
      const riOut = ri.checkOut ? parseStayDate(ri.checkOut) : checkOut;
      if (riOut <= riIn) {
        return NextResponse.json({ error: "Некорректный период для номера" }, { status: 400 });
      }
      if (riIn < checkIn || riOut > checkOut) {
        return NextResponse.json({ error: "Период номера должен быть в рамках проживания" }, { status: 400 });
      }
      const avail = await assertRoomAvailable(ri.roomId, riIn, riOut);
      if (!avail.ok) return NextResponse.json({ error: avail.error }, { status: 400 });
    }

    const dormRoomIds: string[] = [];

    const stay = await prisma.$transaction(async (tx) => {
      const created = await tx.organizationStay.create({
        data: {
          organizationId: org.id,
          hotelId,
          checkIn,
          checkOut,
          notes: String(body.notes ?? "").trim(),
          status: "active",
        },
      });

      for (const ri of roomInputs) {
        const room = await tx.room.findFirst({
          where: { id: ri.roomId, hotelId },
        });
        if (!room) throw new Error("Номер не найден");

        const riIn = ri.checkIn ? parseStayDate(ri.checkIn) : checkIn;
        const riOut = ri.checkOut ? parseStayDate(ri.checkOut) : checkOut;

        await tx.organizationStayRoom.create({
          data: {
            organizationStayId: created.id,
            roomId: room.id,
            roomNumber: room.number,
            checkIn: riIn,
            checkOut: riOut,
            status: "active",
          },
        });

        if (shouldOccupyRoom(riIn)) {
          const isDorm = await occupyOrganizationRoom(room.id, tx);
          if (isDorm) dormRoomIds.push(room.id);
        }
      }

      return created;
    });

    if (dormRoomIds.length) {
      await syncOrganizationDormRooms(dormRoomIds);
    }

    await recalcOrganizationStayAmount(stay.id);

    const full = await prisma.organizationStay.findUnique({
      where: { id: stay.id },
      include: { rooms: true },
    });

    return NextResponse.json({ ok: true, stay: full });
  } catch (e) {
    console.error("[organization-stays POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось создать проживание") }, { status: 500 });
  }
}
