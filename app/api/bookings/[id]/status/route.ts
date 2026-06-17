import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { setBedStatus } from "@/lib/dorm.server";

const VALID = ["new", "confirmed", "checkedin", "checkedout", "cancelled"] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertBookingWrite(await getSession(), params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const booking = auth.booking;
  const body = await req.json();
  const status = body.status as (typeof VALID)[number];
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
  }
  if (booking.status === "checkedin" && status === "cancelled") {
    return NextResponse.json({ error: "Нельзя отменить проживание заселённого гостя" }, { status: 400 });
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.booking.update({ where: { id: booking.id }, data: { status } }),
  ];
  if (status === "checkedin") {
    if (booking.bedId) {
      // bed status after transaction
    } else {
      ops.push(prisma.room.update({ where: { id: booking.roomId }, data: { status: "occupied" } }));
    }
  }
  if (status === "checkedout") {
    if (booking.bedId) {
      // bed status after transaction
    } else {
      ops.push(prisma.room.update({ where: { id: booking.roomId }, data: { status: "cleaning" } }));
    }
  }
  await prisma.$transaction(ops);

  if (status === "checkedin" && booking.bedId) {
    await setBedStatus(booking.bedId, "occupied");
  }
  if (status === "checkedout" && booking.bedId) {
    await setBedStatus(booking.bedId, "cleaning");
  }

  return NextResponse.json({ ok: true });
}
