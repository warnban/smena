import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { HK_CATEGORY_TYPES, hkTimeNow } from "@/lib/housekeeping";
import { apiErrorMessage } from "@/lib/api-error";
import {
  assertRoomAvailable,
  parseStayDate,
  recalcOrganizationStayAmount,
  shouldOccupyRoom,
} from "@/lib/organization-stay";
import {
  occupyOrganizationRoom,
  releaseOrganizationRoomToCleaning,
  syncOrganizationDormRooms,
} from "@/lib/organization-stay-occupancy.server";

async function loadStayRoom(stayId: string, roomStayId: string, seatId: string) {
  return prisma.organizationStayRoom.findFirst({
    where: {
      id: roomStayId,
      organizationStayId: stayId,
      organizationStay: { organization: { seatId } },
    },
    include: {
      room: true,
      organizationStay: { include: { organization: true } },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; roomStayId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sr = await loadStayRoom(params.id, params.roomStayId, session.seatId);
    if (!sr) return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
    if (sr.status !== "active") {
      return NextResponse.json({ error: "Номер уже выселен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, sr.organizationStay.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const checkIn = body.checkIn ? parseStayDate(body.checkIn) : sr.checkIn;
    const checkOut = body.checkOut ? parseStayDate(body.checkOut) : sr.checkOut;

    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "Дата выезда должна быть позже заезда" }, { status: 400 });
    }

    const stay = sr.organizationStay;
    if (checkIn < stay.checkIn || checkOut > stay.checkOut) {
      return NextResponse.json({ error: "Период номера должен быть в рамках проживания" }, { status: 400 });
    }

    const avail = await assertRoomAvailable(sr.roomId, checkIn, checkOut, sr.id);
    if (!avail.ok) return NextResponse.json({ error: avail.error }, { status: 400 });

    const dormRoomIds: string[] = [];

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.organizationStayRoom.update({
        where: { id: sr.id },
        data: { checkIn, checkOut },
      });

      if (shouldOccupyRoom(checkIn)) {
        const isDorm = await occupyOrganizationRoom(sr.roomId, tx);
        if (isDorm) dormRoomIds.push(sr.roomId);
      }

      return row;
    });

    if (dormRoomIds.length) {
      await syncOrganizationDormRooms(dormRoomIds);
    }

    await recalcOrganizationStayAmount(stay.id);
    return NextResponse.json({ ok: true, room: updated });
  } catch (e) {
    console.error("[organization-stay-room PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось обновить номер") }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; roomStayId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sr = await loadStayRoom(params.id, params.roomStayId, session.seatId);
    if (!sr) return NextResponse.json({ error: "Номер не найден" }, { status: 404 });
    if (sr.status !== "active") {
      return NextResponse.json({ error: "Номер уже выселен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, sr.organizationStay.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const checkoutDate = body.checkOutDate ? parseStayDate(body.checkOutDate) : parseStayDate(new Date());
    if (checkoutDate < sr.checkIn) {
      return NextResponse.json({ error: "Дата выезда раньше заезда" }, { status: 400 });
    }

    const time = hkTimeNow();
    const orgName = sr.organizationStay.organization.name;

    const dormRoomIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.organizationStayRoom.update({
        where: { id: sr.id },
        data: {
          status: "checked_out",
          checkedOutAt: checkoutDate,
          checkOut: checkoutDate,
        },
      });
      const isDorm = await releaseOrganizationRoomToCleaning(sr.roomId, tx);
      if (isDorm) dormRoomIds.push(sr.roomId);
      await tx.hkTask.create({
        data: {
          hotelId: sr.organizationStay.hotelId,
          roomId: sr.roomId,
          organizationStayId: sr.organizationStayId,
          organizationStayRoomId: sr.id,
          roomNumber: sr.roomNumber,
          type: HK_CATEGORY_TYPES.checkout,
          category: "checkout",
          assignee: "—",
          priority: "high",
          status: "pending",
          time,
          est: "60 мин",
        },
      });
    });

    if (dormRoomIds.length) {
      await syncOrganizationDormRooms(dormRoomIds);
    }

    await recalcOrganizationStayAmount(sr.organizationStayId);

    const activeLeft = await prisma.organizationStayRoom.count({
      where: { organizationStayId: sr.organizationStayId, status: "active" },
    });
    if (activeLeft === 0) {
      await prisma.organizationStay.update({
        where: { id: sr.organizationStayId },
        data: { status: "completed" },
      });
    }

    return NextResponse.json({ ok: true, organizationName: orgName });
  } catch (e) {
    console.error("[organization-stay-room checkout]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось выселить номер") }, { status: 500 });
  }
}
