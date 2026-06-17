import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertHotelWrite } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";

type SaleItem = { serviceId: string; qty: number };

export async function POST(req: NextRequest) {
  const session = await import("@/lib/auth").then((m) => m.getSession());
  const body = await req.json();
  const hotelId = String(body.hotelId ?? "");
  const kind = body.kind === "expense" ? "expense" : "service";
  const paymentMethod = String(body.paymentMethod ?? "cash");
  const items = (body.items ?? []) as SaleItem[];
  const bookingId = body.bookingId ?? null;
  const guestName = body.guestName ?? null;
  const note = body.note ?? null;

  if (!hotelId || !items.length) {
    return NextResponse.json({ error: "Укажите отель и позиции" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

  const services = await prisma.service.findMany({
    where: {
      id: { in: items.map((i) => i.serviceId) },
      seatId: auth.session.seatId,
      kind: kind === "expense" ? "expense" : "service",
      active: true,
    },
  });
  if (services.length !== items.length) {
    return NextResponse.json({ error: "Некоторые позиции не найдены" }, { status: 400 });
  }

  let roomNumber: string | null = null;
  let resolvedGuestName = guestName;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });
    if (booking && booking.hotelId === hotelId) {
      roomNumber = booking.room.number;
      resolvedGuestName = resolvedGuestName ?? booking.guestName;
    }
  }

  const svcMap = Object.fromEntries(services.map((s) => [s.id, s]));
  const ops = [];
  let total = 0;

  for (const item of items) {
    const svc = svcMap[item.serviceId];
    const qty = Math.max(1, Math.round(Number(item.qty) || 1));
    const amount = svc.price * qty;
    total += amount;

    if (kind === "service") {
      ops.push(
        prisma.serviceSale.create({
          data: {
            hotelId,
            bookingId,
            serviceId: svc.id,
            guestName: resolvedGuestName ?? "",
            serviceName: svc.name,
            serviceCategory: svc.category,
            qty,
            amount,
            paymentMethod,
          },
        })
      );
    }

    ops.push(
      prisma.transaction.create({
        data: {
          hotelId,
          type: kind === "expense" ? "expense" : "service",
          category: svc.category,
          paymentMethod,
          amount,
          bookingId,
          guestName: resolvedGuestName,
          roomNumber,
          note: kind === "expense" ? (note ?? svc.name) : note,
        },
      })
    );
  }

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true, total });
}
