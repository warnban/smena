import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { assertPaymentsOpen } from "@/lib/payment-lock";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertBookingWrite(await getSession(), params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const booking = auth.booking;
  const body = await req.json();
  const qty = Math.max(1, Math.round(Number(body.qty) || 1));

  const payLock = await assertPaymentsOpen(booking.hotelId);
  if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

  const service = await prisma.service.findFirst({
    where: {
      id: body.serviceId,
      OR: [{ seatId: auth.session.seatId }, { seatId: null }],
    },
  });
  if (!service) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });

  const amount = service.price * qty;
  const method = body.paymentMethod ?? "cash";

  await prisma.$transaction([
    prisma.serviceSale.create({
      data: {
        hotelId: booking.hotelId,
        bookingId: booking.id,
        serviceId: service.id,
        guestName: booking.guestName,
        serviceName: service.name,
        serviceCategory: service.category,
        qty,
        amount,
        paymentMethod: method,
      },
    }),
    prisma.transaction.create({
      data: {
        hotelId: booking.hotelId,
        type: "service",
        category: service.category,
        paymentMethod: method,
        amount,
        bookingId: booking.id,
        guestName: booking.guestName,
        roomNumber: booking.room.number,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, amount });
}
