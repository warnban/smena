import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  buildRefundQuoteFromContext,
  canRefundBooking,
  loadRefundContext,
} from "@/lib/booking-refund";
import { accommodationPaidTotal, nightsConsumedThrough, prepaidNights } from "@/lib/booking-payment-due";
import { apiErrorMessage } from "@/lib/api-error";
import {
  buildRefundGuestSearchWhere,
  refundHasPrepaymentFilter,
  refundSearchStatusFilter,
  resolveRefundSearchHotelIds,
} from "@/lib/refund-search.server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    if (!q) {
      return NextResponse.json({ bookings: [] });
    }

    const hotelsResolved = await resolveRefundSearchHotelIds(session, hotelId);
    if (!hotelsResolved.ok) {
      return NextResponse.json({ error: hotelsResolved.error }, { status: hotelsResolved.status });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        hotelId: { in: hotelsResolved.hotelIds },
        hotel: { seatId: session.seatId },
        ...refundSearchStatusFilter(),
        ...refundHasPrepaymentFilter(),
        ...buildRefundGuestSearchWhere(q),
      },
      include: {
        room: true,
        hotel: { select: { name: true } },
        guest: { select: { name: true, phone: true } },
      },
      orderBy: [{ checkIn: "desc" }, { guestName: "asc" }],
      take: 50,
    });

    const results = await Promise.all(
      bookings.map(async (b) => {
        const ctx = await loadRefundContext(b.id, b.hotelId, session.seatId!);
        if (!ctx) return null;

        const effectivePaid = accommodationPaidTotal(ctx.booking, ctx.transactions);
        const bookingPaid = { ...ctx.booking, paid: effectivePaid };
        const consumed = nightsConsumedThrough(bookingPaid);
        const prepaid = prepaidNights(bookingPaid, undefined, ctx.transactions, ctx.refundNightsTotal);
        const quote = buildRefundQuoteFromContext(ctx, 1, 0);
        const maxQuote =
          quote.maxRefundNights > 0
            ? buildRefundQuoteFromContext(ctx, quote.maxRefundNights, 0)
            : quote;
        const canRefund = canRefundBooking(bookingPaid, undefined, ctx.transactions, ctx.refundNightsTotal);

        return {
          id: b.id,
          hotelId: b.hotelId,
          hotelName: b.hotel.name,
          guestName: b.guestName || b.guest.name,
          roomNumber: b.room.number,
          checkIn: b.checkIn.toISOString(),
          checkOut: b.checkOut.toISOString(),
          amount: b.amount,
          paid: effectivePaid,
          prepaidNights: prepaid,
          consumedNights: consumed,
          refundableNights: quote.maxRefundNights,
          maxRefundAmount: maxQuote.refundAmount,
          canRefund,
        };
      })
    );

    const sorted = results
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.canRefund !== b!.canRefund) return a!.canRefund ? -1 : 1;
        return b!.refundableNights - a!.refundableNights;
      });

    return NextResponse.json({ bookings: sorted });
  } catch (e) {
    console.error("[refunds/search GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
