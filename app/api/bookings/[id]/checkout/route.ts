import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { HK_CATEGORY_TYPES, hkTimeNow } from "@/lib/housekeeping";
import { formatBedDisplay, setBedStatus } from "@/lib/dorm.server";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertBookingWrite(await getSession(), params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const booking = auth.booking;
  const bed = booking.bedId
    ? await prisma.bed.findUnique({ where: { id: booking.bedId } })
    : null;
  const roomNumber = bed ? formatBedDisplay(bed.label) : booking.room.number;

  const now = new Date();
  const time = hkTimeNow();

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "checkedout", checkedOutAt: now },
    }),
    ...(booking.bedId
      ? []
      : [prisma.room.update({ where: { id: booking.roomId }, data: { status: "cleaning" } })]),
    prisma.hkTask.create({
      data: {
        hotelId: booking.hotelId,
        roomId: booking.roomId,
        bedId: booking.bedId,
        bookingId: booking.id,
        roomNumber,
        type: HK_CATEGORY_TYPES.checkout,
        category: "checkout",
        assignee: "—",
        priority: "high",
        status: "pending",
        time,
        est: "60 мин",
      },
    }),
  ]);

  if (booking.bedId) {
    await setBedStatus(booking.bedId, "cleaning");
  }

  return NextResponse.json({ ok: true });
}
