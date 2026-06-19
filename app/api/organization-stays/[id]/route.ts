import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { parseStayDate, recalcOrganizationStayAmount } from "@/lib/organization-stay";
import {
  releaseOrganizationRoom,
  syncOrganizationDormRooms,
} from "@/lib/organization-stay-occupancy.server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const stay = await prisma.organizationStay.findUnique({
      where: { id: params.id },
      include: { organization: true },
    });
    if (!stay || stay.organization.seatId !== session?.seatId) {
      return NextResponse.json({ error: "Проживание не найдено" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, stay.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const checkIn = body.checkIn ? parseStayDate(body.checkIn) : stay.checkIn;
    const checkOut = body.checkOut ? parseStayDate(body.checkOut) : stay.checkOut;
    if (checkOut <= checkIn) {
      return NextResponse.json({ error: "Дата выезда должна быть позже заезда" }, { status: 400 });
    }

    const cancelling = body.status === "cancelled";

    if (cancelling && stay.status === "active") {
      const dormRoomIds: string[] = [];
      await prisma.$transaction(async (tx) => {
        await tx.organizationStay.update({
          where: { id: stay.id },
          data: {
            checkIn,
            checkOut,
            ...(body.notes !== undefined ? { notes: String(body.notes).trim() } : {}),
            status: "cancelled",
          },
        });

        const activeRooms = await tx.organizationStayRoom.findMany({
          where: { organizationStayId: stay.id, status: "active" },
          include: { room: { select: { kind: true } } },
        });

        for (const sr of activeRooms) {
          await tx.organizationStayRoom.update({
            where: { id: sr.id },
            data: { status: "checked_out", checkedOutAt: new Date() },
          });
          const isDorm = await releaseOrganizationRoom(sr.roomId, tx);
          if (isDorm) dormRoomIds.push(sr.roomId);
        }
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
    }

    const updated = await prisma.organizationStay.update({
      where: { id: stay.id },
      data: {
        checkIn,
        checkOut,
        ...(body.notes !== undefined ? { notes: String(body.notes).trim() } : {}),
        ...(body.status === "cancelled" ? { status: "cancelled" } : {}),
      },
      include: { rooms: true },
    });

    await recalcOrganizationStayAmount(stay.id);

    const full = await prisma.organizationStay.findUnique({
      where: { id: stay.id },
      include: { rooms: true },
    });

    return NextResponse.json({ ok: true, stay: full ?? updated });
  } catch (e) {
    console.error("[organization-stays PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось обновить проживание") }, { status: 500 });
  }
}
