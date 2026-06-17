import "server-only";

import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import {
  filterPaymentDueBookings,
  paymentDueInfo,
  paymentSoonInfo,
  filterPaymentDueSoonBookings,
  bookingStayNights,
  firstUnpaidNightDateKey,
} from "@/lib/booking-payment-due";
import { calcStayAmount } from "@/lib/booking-pricing";
import { buildRefundQuoteFromContext, canRefundBooking, loadRefundContext } from "@/lib/booking-refund";
import { mskDateKey, mskNightDiff, mskAddDays, parseMskDateKey } from "@/lib/msk-time";
import { findAvailableRooms, resolveRoomForBooking } from "@/lib/booking-availability.server";
import { hotelHasDiscountRules, formatRuleLabel, matchDiscountRule, calcPaymentWithRule, calcNightPaymentTotal, activeRulesForHotel } from "@/lib/hotel-discount-rules";
import { searchFaqChunks } from "@/lib/assistant/faq.server";
import type { PendingAction } from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";

export const ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_faq",
      description: "Поиск по базе знаний FAQ сети. Используй для вопросов о правилах, процедурах, инструкциях.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Поисковый запрос" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_guests",
      description: "Найти гостей по ФИО или части имени",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          hotelId: { type: "string", description: "Опционально — фильтр по отелю через активные брони" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_bookings",
      description: "Найти брони по имени гостя, номеру комнаты или ID брони",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          hotelId: { type: "string" },
          activeOnly: { type: "boolean", description: "Только не отменённые и не выселенные" },
        },
        required: ["query", "hotelId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_booking_payment_status",
      description: "Статус оплаты брони: оплачено до, долг, ночи",
      parameters: {
        type: "object",
        properties: { bookingId: { type: "string" } },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_payment_due",
      description: "Список гостей, которым нужна оплата сегодня или скоро, в отеле",
      parameters: {
        type: "object",
        properties: { hotelId: { type: "string" } },
        required: ["hotelId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "quote_payment",
      description: "Рассчитать сумму оплаты проживания за N ночей",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          nights: { type: "number" },
          paidThroughDate: { type: "string", description: "YYYY-MM-DD альтернатива nights" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "quote_extend_stay",
      description:
        "Только расчёт новой даты выезда и суммы. Не меняет бронь. Для применения продления вызывай propose_extend_stay.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          checkOut: { type: "string", description: "Новая дата выезда YYYY-MM-DD" },
          days: { type: "number", description: "+/- дней от текущего выезда" },
          nights: { type: "number", description: "Синоним days: добавить N ночей к текущему выезду" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "quote_refund",
      description: "Рассчитать сумму возврата за N ночей",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          hotelId: { type: "string" },
          nights: { type: "number" },
          withholdNights: { type: "number" },
        },
        required: ["bookingId", "hotelId", "nights"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_record_payment",
      description: "Предложить провести оплату проживания (требует подтверждения админа)",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          nights: { type: "number" },
          paidThroughDate: { type: "string" },
          note: { type: "string" },
        },
        required: ["bookingId", "nights"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_extend_stay",
      description:
        "Изменить срок проживания (продление/сокращение). Создаёт карточку подтверждения — бронь меняется только после нажатия «Подтвердить».",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          checkOut: { type: "string", description: "Новая дата выезда YYYY-MM-DD" },
          days: { type: "number", description: "+/- дней от текущего выезда" },
          nights: { type: "number", description: "Добавить N ночей к текущему выезду" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_refund",
      description: "Предложить возврат (требует подтверждения)",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          hotelId: { type: "string" },
          nights: { type: "number" },
          withholdNights: { type: "number" },
          note: { type: "string" },
        },
        required: ["bookingId", "hotelId", "nights"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_available_rooms",
      description:
        "Свободные номера на даты заезда/выезда. Используй перед бронью, если админ не назвал номер или просит «любой свободный».",
      parameters: {
        type: "object",
        properties: {
          hotelId: { type: "string" },
          checkIn: { type: "string", description: "YYYY-MM-DD" },
          checkOut: { type: "string", description: "YYYY-MM-DD" },
          nights: { type: "number", description: "Альтернатива checkOut: ночей от checkIn" },
          category: { type: "string", description: "Фильтр по категории (Double, Single…)" },
          roomNumber: { type: "string", description: "Поиск по номеру" },
          guestId: { type: "string", description: "Для фильтра общих комнат по полу гостя" },
          guestGender: { type: "string", description: "M или F — для подбора общей комнаты" },
          limit: { type: "number" },
        },
        required: ["hotelId", "checkIn"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_create_booking",
      description:
        "Предложить создать бронь (требует подтверждения). Номер можно не указывать — подберётся первый свободный.",
      parameters: {
        type: "object",
        properties: {
          hotelId: { type: "string" },
          guestName: { type: "string" },
          guestId: { type: "string" },
          checkIn: { type: "string", description: "YYYY-MM-DD" },
          checkOut: { type: "string", description: "YYYY-MM-DD" },
          nights: { type: "number", description: "Альтернатива checkOut" },
          roomId: { type: "string" },
          roomNumber: { type: "string", description: "Номер комнаты, например 101" },
          anyAvailable: {
            type: "boolean",
            description: "true — любой свободный номер (по умолчанию, если roomId/roomNumber не заданы)",
          },
          category: { type: "string" },
          phone: { type: "string" },
          isForeigner: { type: "boolean" },
          guestGender: { type: "string", description: "M или F" },
          bedId: { type: "string" },
        },
        required: ["hotelId", "checkIn", "guestName"],
      },
    },
  },
];

async function assertBookingAccess(session: SessionPayload, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true, hotel: true },
  });
  if (!booking || booking.hotel.seatId !== session.seatId) {
    return { ok: false as const, error: "Бронь не найдена" };
  }
  return { ok: true as const, booking };
}

export async function runAssistantTool(
  session: SessionPayload,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; pendingAction?: PendingAction }> {
  switch (name) {
    case "search_faq": {
      const r = await searchFaqChunks(session.seatId!, String(args.query ?? ""));
      if (r.empty) {
        return {
          result: {
            faqConfigured: false,
            message: "FAQ пока не заполнен. Владелец или управляющий может добавить его в Настройки → Система.",
            chunks: [],
          },
        };
      }
      return {
        result: {
          faqConfigured: true,
          chunks: r.chunks.map((c) => ({ title: c.title, content: c.content, relevance: c.score })),
        },
      };
    }

    case "find_guests": {
      const q = String(args.query ?? "").trim();
      if (!q) return { result: { guests: [] } };
      const guests = await prisma.guest.findMany({
        where: {
          seatId: session.seatId!,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        select: { id: true, name: true, phone: true, isForeigner: true, gender: true },
      });
      return { result: { guests } };
    }

    case "find_bookings": {
      const q = String(args.query ?? "").trim();
      const hotelId = String(args.hotelId ?? "");
      const activeOnly = args.activeOnly !== false;
      if (!q || !hotelId) return { result: { bookings: [] } };

      const bookings = await prisma.booking.findMany({
        where: {
          hotelId,
          hotel: { seatId: session.seatId! },
          ...(activeOnly ? { status: { notIn: ["cancelled", "checkedout"] } } : {}),
          OR: [
            { guestName: { contains: q, mode: "insensitive" } },
            { id: q },
            { room: { number: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { room: { select: { number: true } } },
        take: 8,
        orderBy: { checkIn: "desc" },
      });

      return {
        result: {
          bookings: bookings.map((b) => ({
            id: b.id,
            guestName: b.guestName,
            roomNumber: b.room.number,
            status: b.status,
            checkIn: fmtDate(b.checkIn),
            checkOut: fmtDate(b.checkOut),
            amount: b.amount,
            paid: b.paid,
          })),
        },
      };
    }

    case "get_booking_payment_status": {
      const access = await assertBookingAccess(session, String(args.bookingId));
      if (!access.ok) return { result: { error: access.error } };
      const { booking } = access;
      const txs = await prisma.transaction.findMany({
        where: { bookingId: booking.id, cancelledAt: null },
      });
      const info = paymentDueInfo(booking, mskDateKey(), txs);
      return {
        result: {
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
          status: booking.status,
          checkIn: fmtDate(booking.checkIn),
          checkOut: fmtDate(booking.checkOut),
          totalAmount: booking.amount,
          paidTotal: info.effectivePaid,
          prepaidNights: info.prepaidNights,
          paidThrough: info.paidThroughKey,
          firstUnpaidNight: info.firstUnpaidNightKey,
          debtToday: info.debt,
          debtNights: info.debtNights,
          nightlyRate: info.nightly,
        },
      };
    }

    case "list_payment_due": {
      const hotelId = String(args.hotelId ?? "");
      const bookings = await prisma.booking.findMany({
        where: { hotelId, hotel: { seatId: session.seatId! }, status: "checkedin" },
        include: { room: true },
      });
      const txs = await prisma.transaction.findMany({
        where: { hotelId, cancelledAt: null },
      });
      const dueToday = filterPaymentDueBookings(bookings, mskDateKey(), txs);
      const dueSoon = filterPaymentDueSoonBookings(bookings, mskDateKey(), txs);
      const byId = new Map(bookings.map((b) => [b.id, b]));

      return {
        result: {
          dueToday: dueToday.map((b) => {
            const info = paymentDueInfo(b, mskDateKey(), txs);
            const full = byId.get(b.id)!;
            return {
              bookingId: b.id,
              guestName: b.guestName,
              roomNumber: full.room.number,
              debt: info.debt,
              prepaidNights: info.prepaidNights,
            };
          }),
          dueSoon: dueSoon.map((b) => {
            const info = paymentSoonInfo(b, mskDateKey(), txs);
            const full = byId.get(b.id)!;
            return {
              bookingId: b.id,
              guestName: b.guestName,
              roomNumber: full.room.number,
              paidThrough: info.paidThroughKey,
              nightsAhead: info.nightsAhead,
            };
          }),
        },
      };
    }

    case "quote_payment": {
      const access = await assertBookingAccess(session, String(args.bookingId));
      if (!access.ok) return { result: { error: access.error } };
      const booking = access.booking;
      const txs = await prisma.transaction.findMany({
        where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
      });
      const discountRules = await prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } });
      const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);

      let nights = Math.max(1, Math.round(Number(args.nights) || 1));
      const paidThroughRaw = args.paidThroughDate ? String(args.paidThroughDate).slice(0, 10) : "";
      const firstUnpaid = firstUnpaidNightDateKey(booking, undefined, txs);

      if (paidThroughRaw) {
        const checkOutKey = mskDateKey(booking.checkOut);
        if (paidThroughRaw < firstUnpaid || paidThroughRaw > checkOutKey) {
          return { result: { error: "Некорректная дата «оплачено до»" } };
        }
        nights = Math.max(1, mskNightDiff(firstUnpaid, mskAddDays(paidThroughRaw, 1)));
      }

      const hotelRules = activeRulesForHotel(discountRules, booking.hotelId);
      const matched = useRules
        ? matchDiscountRule(hotelRules, { paymentNights: nights, paymentMethod: "cash" })
        : null;
      const amount = useRules
        ? calcPaymentWithRule(booking.room.price, nights, matched)
        : calcNightPaymentTotal(
            booking.room.price,
            nights,
            booking.discountPercent ?? 0,
            booking.discountPerNight ?? 0
          );

      return {
        result: {
          bookingId: booking.id,
          guestName: booking.guestName,
          nights,
          firstUnpaidNight: firstUnpaid,
          paidThroughDate: paidThroughRaw || mskAddDays(firstUnpaid, nights - 1),
          amount,
          discountNote: matched ? formatRuleLabel(matched) : null,
        },
      };
    }

    case "quote_extend_stay": {
      const access = await assertBookingAccess(session, String(args.bookingId));
      if (!access.ok) return { result: { error: access.error } };
      const booking = access.booking;
      const prevKey = mskDateKey(booking.checkOut);
      let newKey = args.checkOut ? String(args.checkOut).slice(0, 10) : "";
      if (!newKey && (args.days != null || args.nights != null)) {
        const delta = Math.round(Number(args.days ?? args.nights));
        newKey = mskAddDays(prevKey, delta);
      }
      if (!newKey) return { result: { error: "Укажите checkOut, days или nights" } };

      const newCheckOut = parseMskDateKey(newKey);
      const newAmount = calcStayAmount({
        roomPrice: booking.room.price,
        checkIn: booking.checkIn,
        checkOut: newCheckOut,
        discountPercent: booking.discountPercent ?? 0,
        discountPerNight: booking.discountPerNight ?? 0,
      });

      return {
        result: {
          quoteOnly: true,
          bookingId: booking.id,
          guestName: booking.guestName,
          previousCheckOut: prevKey,
          newCheckOut: newKey,
          previousAmount: booking.amount,
          newAmount,
          amountDelta: newAmount - booking.amount,
          nightDelta: mskNightDiff(booking.checkIn, newKey) - bookingStayNights(booking),
          note: "Только расчёт. Бронь не изменена — для применения нужен propose_extend_stay и подтверждение админа.",
        },
      };
    }

    case "quote_refund": {
      const bookingId = String(args.bookingId);
      const hotelId = String(args.hotelId);
      const nights = Math.round(Number(args.nights) || 0);
      const withholdNights = Math.max(0, Math.min(1, Math.round(Number(args.withholdNights) || 0)));
      const ctx = await loadRefundContext(bookingId, hotelId, session.seatId!);
      if (!ctx) return { result: { error: "Бронь не найдена" } };
      if (!canRefundBooking(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal)) {
        return { result: { error: "Нет доступных ночей для возврата" } };
      }
      const quote = buildRefundQuoteFromContext(ctx, nights, withholdNights);
      return {
        result: {
          bookingId,
          guestName: ctx.booking.guestName,
          nights,
          maxRefundNights: quote.maxRefundNights,
          amount: quote.refundAmount,
          recalcNote: quote.recalcNote,
        },
      };
    }

    case "propose_record_payment": {
      const quote = await runAssistantTool(session, "quote_payment", args);
      const q = quote.result as Record<string, unknown>;
      if (q.error) return { result: q };
      const access = await assertBookingAccess(session, String(args.bookingId));
      if (!access.ok) return { result: { error: access.error } };

      const preview =
        `Оплата проживания: ${access.booking.guestName}, №${access.booking.room.number}\n` +
        `${q.nights} ноч. · ${q.amount} ₽ · до ${q.paidThroughDate} 12:00` +
        (q.discountNote ? `\nСкидка: ${q.discountNote}` : "");

      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "record_payment",
          preview,
          payload: {
            bookingId: args.bookingId,
            nights: q.nights,
            paidThroughDate: q.paidThroughDate,
            amount: q.amount,
            note: args.note ?? "",
          },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_extend_stay": {
      const quote = await runAssistantTool(session, "quote_extend_stay", args);
      const q = quote.result as Record<string, unknown>;
      if (q.error) return { result: q };
      const amountDelta = Number(q.amountDelta);
      const preview =
        `Изменение срока: ${q.guestName}\n` +
        `Выезд ${q.previousCheckOut} → ${q.newCheckOut}\n` +
        `Сумма ${q.previousAmount} → ${q.newAmount} ₽ (${amountDelta >= 0 ? "+" : ""}${amountDelta} ₽)`;

      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "extend_stay",
          preview,
          payload: {
            bookingId: String(args.bookingId ?? q.bookingId),
            checkOut: q.newCheckOut,
          },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_refund": {
      const quote = await runAssistantTool(session, "quote_refund", args);
      const q = quote.result as Record<string, unknown>;
      if (q.error) return { result: q };
      const preview =
        `Возврат: ${q.guestName}\n${q.nights} ноч. · ${q.amount} ₽` +
        (q.recalcNote ? `\n${q.recalcNote}` : "");

      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "process_refund",
          preview,
          payload: {
            hotelId: args.hotelId,
            bookingId: args.bookingId,
            nights: q.nights,
            withholdNights: args.withholdNights ?? 0,
            note: args.note ?? "",
          },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "find_available_rooms": {
      const hotelId = String(args.hotelId ?? "");
      let checkIn = String(args.checkIn ?? "").slice(0, 10);
      let checkOut = args.checkOut ? String(args.checkOut).slice(0, 10) : "";
      const nights = Math.round(Number(args.nights) || 0);

      if (!hotelId || !checkIn) {
        return { result: { error: "Укажите hotelId и checkIn" } };
      }
      if (!checkOut && nights > 0) {
        checkOut = mskAddDays(checkIn, nights);
      }
      if (!checkOut) {
        return { result: { error: "Укажите checkOut или nights" } };
      }

      const hotel = await prisma.hotel.findFirst({
        where: { id: hotelId, seatId: session.seatId! },
      });
      if (!hotel) return { result: { error: "Отель не найден" } };

      let guestGender = args.guestGender
        ? (String(args.guestGender).toUpperCase() === "F" ? ("F" as const) : ("M" as const))
        : undefined;
      if (args.guestId && !guestGender) {
        const guest = await prisma.guest.findFirst({
          where: { id: String(args.guestId), seatId: session.seatId! },
          select: { gender: true },
        });
        guestGender = guest?.gender;
      }

      const { rooms, nights: n } = await findAvailableRooms({
        hotelId,
        checkIn,
        checkOut,
        category: args.category ? String(args.category) : undefined,
        roomNumber: args.roomNumber ? String(args.roomNumber) : undefined,
        guestGender,
        limit: Math.min(20, Math.max(1, Math.round(Number(args.limit) || 10))),
      });

      return {
        result: {
          checkIn,
          checkOut,
          nights: n,
          count: rooms.length,
          rooms: rooms.map((r) => ({
            roomId: r.roomId,
            bedId: r.bedId,
            kind: r.kind,
            dormGender: r.dormGender,
            number: r.number,
            category: r.category,
            floor: r.floor,
            pricePerNight: r.price,
            amount: r.amount,
          })),
        },
      };
    }

    case "propose_create_booking": {
      const hotelId = String(args.hotelId ?? "");
      let checkIn = String(args.checkIn ?? "").slice(0, 10);
      let checkOut = args.checkOut ? String(args.checkOut).slice(0, 10) : "";
      const nightsArg = Math.round(Number(args.nights) || 0);

      if (!checkOut && nightsArg > 0 && checkIn) {
        checkOut = mskAddDays(checkIn, nightsArg);
      }
      if (!hotelId || !checkIn || !checkOut) {
        return { result: { error: "Укажите hotelId, checkIn и checkOut (или nights)" } };
      }

      let guestGender = args.guestGender
        ? (String(args.guestGender).toUpperCase() === "F" ? ("F" as const) : ("M" as const))
        : undefined;

      const resolved = await resolveRoomForBooking({
        hotelId,
        seatId: session.seatId!,
        checkIn,
        checkOut,
        roomId: args.roomId ? String(args.roomId) : undefined,
        bedId: args.bedId ? String(args.bedId) : undefined,
        roomNumber: args.roomNumber ? String(args.roomNumber) : undefined,
        anyAvailable: args.anyAvailable !== false,
        category: args.category ? String(args.category) : undefined,
        guestId: args.guestId ? String(args.guestId) : undefined,
        guestGender,
      });

      if (!resolved.ok) return { result: { error: resolved.error } };

      const { room, bedId, bedLabel, nights, autoPicked } = resolved;
      const amount = calcStayAmount({
        roomPrice: room.price,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
      });

      const guestLabel = String(args.guestName ?? "").trim() || "Гость";
      const foreignNote = args.isForeigner ? " · иностранец" : "";
      const phoneNote = args.phone ? `\nТел: ${args.phone}` : "";
      const placeLabel = bedLabel ?? room.number;

      const preview =
        `Новая бронь: ${guestLabel}${foreignNote}\n` +
        `№${placeLabel} (${room.category})${autoPicked ? " · подобрано автоматически" : ""}\n` +
        `${checkIn} — ${checkOut} · ${nights} ноч. · ${amount} ₽` +
        phoneNote;

      const payload = {
        hotelId,
        roomId: room.id,
        bedId,
        guestName: guestLabel,
        guestId: args.guestId,
        checkIn,
        checkOut,
        phone: args.phone ?? "",
        isForeigner: Boolean(args.isForeigner),
        amount,
      };

      return {
        result: { status: "awaiting_confirmation", preview, roomNumber: placeLabel, autoPicked },
        pendingAction: {
          type: "create_booking",
          preview,
          payload,
          createdAt: new Date().toISOString(),
        },
      };
    }

    default:
      return { result: { error: `Неизвестный инструмент: ${name}` } };
  }
}
