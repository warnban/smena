import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { buildRefundQuoteFromContext, loadRefundContext } from "@/lib/booking-refund";
import { nightsConsumedThrough, prepaidNights } from "@/lib/booking-payment-due";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId") ?? "";
    const bookingId = req.nextUrl.searchParams.get("bookingId") ?? "";
    const refundNights = Math.max(0, Math.round(Number(req.nextUrl.searchParams.get("nights")) || 0));
    const withholdNights = Math.max(0, Math.min(1, Math.round(Number(req.nextUrl.searchParams.get("withholdNights")) || 0)));

    if (!hotelId || !bookingId) {
      return NextResponse.json({ error: "hotelId и bookingId обязательны" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const ctx = await loadRefundContext(bookingId, hotelId, session.seatId);
    if (!ctx) {
      return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
    }

    const consumed = nightsConsumedThrough(ctx.booking);
    const prepaid = prepaidNights(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal);
    const quote = buildRefundQuoteFromContext(ctx, refundNights || 1, withholdNights);

    return NextResponse.json({
      quote,
      consumedNights: consumed,
      prepaidNights: prepaid,
      refundableNights: quote.maxRefundNights,
    });
  } catch (e) {
    console.error("[refunds/quote GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
