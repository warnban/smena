import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import {
  buildRefundQuoteFromContext,
  canRefundBooking,
  loadRefundContext,
} from "@/lib/booking-refund";
import { apiErrorMessage } from "@/lib/api-error";
import { fileServeUrl } from "@/lib/file-url";
import { buildAccommodationRefundNote } from "@/lib/booking-transaction-notes";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rows = await prisma.refundRecord.findMany({
      where: { hotelId, hotel: { seatId: session.seatId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        booking: { select: { roomId: true } },
      },
    });

    return NextResponse.json({
      refunds: rows.map((r) => ({
        id: r.id,
        hotelId: r.hotelId,
        bookingId: r.bookingId,
        transactionId: r.transactionId,
        guestName: r.guestName,
        nights: r.nights,
        amount: r.amount,
        paymentMethod: r.paymentMethod,
        note: r.note,
        withholdNights: r.withholdNights,
        recalcNote: r.recalcNote,
        documentPath: fileServeUrl(r.documentPath),
        documentName: r.documentName,
        createdAt: r.createdAt.toISOString(),
        roomId: r.booking.roomId,
      })),
    });
  } catch (e) {
    console.error("[refunds GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "");
    const bookingId = String(body.bookingId ?? "");
    const nights = Math.round(Number(body.nights) || 0);
    const withholdNights = Math.max(0, Math.min(1, Math.round(Number(body.withholdNights) || 0)));
    const paymentMethod = String(body.paymentMethod ?? "cash");
    const note = String(body.note ?? "").trim();

    if (!hotelId || !bookingId || nights <= 0) {
      return NextResponse.json({ error: "Укажите отель, бронь и количество ночей" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payLock = await assertPaymentsOpen(hotelId);
    if (!payLock.ok) {
      return NextResponse.json({ error: payLock.error }, { status: payLock.status });
    }

    const ctx = await loadRefundContext(bookingId, hotelId, session.seatId);
    if (!ctx) {
      return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
    }

    if (!canRefundBooking(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal)) {
      return NextResponse.json({ error: "Нет доступных ночей для возврата" }, { status: 400 });
    }

    const quote = buildRefundQuoteFromContext(ctx, nights, withholdNights);
    if (nights > quote.maxRefundNights) {
      return NextResponse.json({
        error: `Можно вернуть не более ${quote.maxRefundNights} ноч.${withholdNights ? ` (удержано ${withholdNights} ноч.)` : ""}`,
      }, { status: 400 });
    }

    const amount = quote.refundAmount;
    if (amount <= 0 || amount > ctx.booking.paid) {
      return NextResponse.json({ error: "Некорректная сумма возврата" }, { status: 400 });
    }

    let refundNote = buildAccommodationRefundNote(ctx.booking, nights, note || null);
    if (quote.recalcNote) {
      refundNote = `${refundNote}. ${quote.recalcNote}`;
    }
    if (withholdNights > 0) {
      refundNote = `${refundNote}. Удержание ${withholdNights} ноч.`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          hotelId,
          bookingId: ctx.booking.id,
          type: "refund",
          category: "accommodation",
          paymentMethod,
          amount,
          guestName: ctx.booking.guestName,
          roomNumber: ctx.roomNumber,
          note: refundNote,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: ctx.booking.id },
        data: { paid: Math.max(0, ctx.booking.paid - amount) },
      });

      const refund = await tx.refundRecord.create({
        data: {
          hotelId,
          bookingId: ctx.booking.id,
          transactionId: transaction.id,
          guestName: ctx.booking.guestName,
          nights,
          amount,
          paymentMethod,
          note: refundNote,
          withholdNights,
          recalcNote: quote.recalcNote,
        },
      });

      return { transaction, updatedBooking, refund };
    });

    return NextResponse.json({
      ok: true,
      refund: {
        id: result.refund.id,
        amount: result.refund.amount,
        nights: result.refund.nights,
        withholdNights: result.refund.withholdNights,
        recalcNote: result.refund.recalcNote,
        createdAt: result.refund.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[refunds POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
