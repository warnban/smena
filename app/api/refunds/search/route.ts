import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import {
  buildRefundQuoteFromContext,
  canRefundBooking,
  loadRefundContext,
} from "@/lib/booking-refund";
import { nightsConsumedThrough, prepaidNights } from "@/lib/booking-payment-due";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const bookings = await prisma.booking.findMany({
      where: {
        hotelId,
        hotel: { seatId: session.seatId },
        status: { in: ["checkedin", "checkedout"] },
        paid: { gt: 0 },
        ...(q ? { guestName: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { room: true },
      orderBy: { guestName: "asc" },
      take: 30,
    });

    const results = await Promise.all(
      bookings.map(async (b) => {
        const ctx = await loadRefundContext(b.id, hotelId, session.seatId!);
        if (!ctx) return null;
        if (!canRefundBooking(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal)) return null;

        const consumed = nightsConsumedThrough(ctx.booking);
        const prepaid = prepaidNights(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal);
        const quote = buildRefundQuoteFromContext(ctx, 1, 0);

        return {
          id: b.id,
          guestName: b.guestName,
          roomNumber: b.room.number,
          checkIn: b.checkIn.toISOString(),
          checkOut: b.checkOut.toISOString(),
          amount: b.amount,
          paid: b.paid,
          prepaidNights: prepaid,
          consumedNights: consumed,
          refundableNights: quote.maxRefundNights,
          maxRefundAmount: buildRefundQuoteFromContext(ctx, quote.maxRefundNights, 0).refundAmount,
        };
      })
    );

    return NextResponse.json({ bookings: results.filter(Boolean) });
  } catch (e) {
    console.error("[refunds/search GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
