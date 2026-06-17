import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import {
  GUEST_FORM_TEMPLATES,
  buildGuestFormContext,
  buildStayAmendmentContext,
  pickGuestBookingForForms,
  type GuestFormId,
  type StayAmendmentPrevious,
} from "@/lib/guest-print-forms";
import {
  renderGuestFormDocx,
  templateExists,
} from "@/lib/guest-print-forms.server";

const VALID_FORMS = new Set<string>([
  "pd-consent",
  "hotel-rules",
  "refund-form",
  "hotel-contract",
  "hotel-contract-amendment",
]);

function parseAmendmentFromQuery(req: NextRequest): StayAmendmentPrevious | null {
  const prevCheckOut = req.nextUrl.searchParams.get("prevCheckOut");
  const prevAmount = req.nextUrl.searchParams.get("prevAmount");
  const prevNights = req.nextUrl.searchParams.get("prevNights");
  if (!prevCheckOut || !prevAmount || !prevNights) return null;
  return {
    checkOut: prevCheckOut,
    amount: Math.round(Number(prevAmount)),
    nights: Math.max(1, Math.round(Number(prevNights))),
  };
}

function parseAmendmentFromBody(body: Record<string, unknown>): StayAmendmentPrevious | null {
  const raw = body.amendment;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (!a.prevCheckOut || a.prevAmount == null || a.prevNights == null) return null;
  return {
    checkOut: String(a.prevCheckOut).slice(0, 10),
    amount: Math.round(Number(a.prevAmount)),
    nights: Math.max(1, Math.round(Number(a.prevNights))),
  };
}

function buildFormContext(
  formId: GuestFormId,
  guest: Parameters<typeof buildGuestFormContext>[0],
  hotel: Parameters<typeof buildGuestFormContext>[1],
  booking: Parameters<typeof buildGuestFormContext>[2],
  room: Parameters<typeof buildGuestFormContext>[3],
  amendment: StayAmendmentPrevious | null
) {
  const base = buildGuestFormContext(guest, hotel, booking, room);
  if (formId === "hotel-contract-amendment") {
    if (!amendment) {
      throw new Error("Для дополнительного соглашения укажите прежние условия проживания");
    }
    return buildStayAmendmentContext(base, amendment, booking);
  }
  return base;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; formId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formId = params.formId as GuestFormId;
    if (!VALID_FORMS.has(formId)) {
      return NextResponse.json({ error: "Неизвестный бланк" }, { status: 400 });
    }

    if (!templateExists(formId)) {
      const meta = GUEST_FORM_TEMPLATES[formId];
      return NextResponse.json(
        {
          error: `Шаблон «${meta.filename}» не загружен. Положите файл в templates/guest-forms/ (см. README.md).`,
        },
        { status: 404 }
      );
    }

    const guest = await prisma.guest.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

    const bookingId = req.nextUrl.searchParams.get("bookingId");
    const format = req.nextUrl.searchParams.get("format") ?? "print";

    let booking: Awaited<ReturnType<typeof prisma.booking.findFirst>> = bookingId
      ? await prisma.booking.findFirst({
          where: { id: bookingId, guestId: guest.id, hotel: { seatId: session.seatId } },
        })
      : null;

    if (!booking) {
      const all = await prisma.booking.findMany({
        where: { guestId: guest.id, hotel: { seatId: session.seatId }, status: { not: "cancelled" } },
        orderBy: { checkIn: "desc" },
      });
      booking = pickGuestBookingForForms(all, guest.id) as typeof booking;
    }

    if (!booking) {
      return NextResponse.json({ error: "У гостя нет бронирования для подстановки периода проживания" }, { status: 400 });
    }

    const hotel = await prisma.hotel.findFirst({
      where: { id: booking.hotelId, seatId: session.seatId },
    });
    if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

    const room = await prisma.room.findUnique({ where: { id: booking.roomId } });

    const amendment = parseAmendmentFromQuery(req);
    const context = buildFormContext(formId, guest, hotel, booking, room, amendment);

    const docxBuffer = renderGuestFormDocx(formId, context);
    const meta = GUEST_FORM_TEMPLATES[formId];
    const safeGuest = guest.name.replace(/[^\wа-яА-ЯёЁ\s-]/gi, "").trim().replace(/\s+/g, "_");
    const filename = `${meta.filename.replace(".docx", "")}_${safeGuest}.docx`;

    if (format === "docx") {
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    const q = new URLSearchParams({
      guestId: params.id,
      formId,
      print: "0",
    });
    if (bookingId) q.set("bookingId", booking.id);
    return NextResponse.redirect(new URL(`/guests/form-print?${q.toString()}`, req.url));
  } catch (e) {
    console.error("[guest form print]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сформировать бланк") }, { status: 500 });
  }
}

/** Превью данных для модального окна подтверждения */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; formId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formId = params.formId as GuestFormId;
    if (!VALID_FORMS.has(formId)) {
      return NextResponse.json({ error: "Неизвестный бланк" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = body.bookingId ? String(body.bookingId) : null;
    const amendment = parseAmendmentFromBody(body as Record<string, unknown>);

    const guest = await prisma.guest.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

    const bookings = await prisma.booking.findMany({
      where: { guestId: guest.id, hotel: { seatId: session.seatId }, status: { not: "cancelled" } },
      orderBy: { checkIn: "desc" },
      include: { room: true, hotel: true },
    });

    if (!bookings.length) {
      return NextResponse.json({ error: "Нет бронирований" }, { status: 400 });
    }

    const selected =
      (bookingId ? bookings.find((b) => b.id === bookingId) : null) ??
      pickGuestBookingForForms(bookings, guest.id);

    if (!selected) {
      return NextResponse.json({ error: "Бронирование не найдено" }, { status: 404 });
    }

    const hotel = bookings.find((b) => b.id === selected.id)!.hotel;
    const room = bookings.find((b) => b.id === selected.id)!.room;

    let context: Record<string, string>;
    try {
      context = buildFormContext(formId, guest, hotel, selected, room, amendment);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Не удалось сформировать контекст" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      form: GUEST_FORM_TEMPLATES[formId],
      templateReady: templateExists(formId),
      context,
      bookings: bookings.map((b) => ({
        id: b.id,
        hotelName: b.hotel.name,
        roomNumber: b.room.number,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
      })),
      selectedBookingId: selected.id,
    });
  } catch (e) {
    console.error("[guest form preview]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
