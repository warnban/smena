import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildPrintFormUrls,
  getMorningBriefing,
  listActiveServices,
  listFreeRoomsNow,
  listHkTasks,
  listTodayArrivals,
  listTodayDepartures,
  whoInRoom,
} from "@/lib/assistant/queries.server";
import { runAssistantTool } from "@/lib/assistant/tools.server";
import type { PendingAction } from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import { formatDormPlaceLabel } from "@/lib/dorm";
import { fmtDate } from "@/lib/format";
import { mskDateKey } from "@/lib/msk-time";

export const HAMSTER_EXTRA_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_morning_briefing",
      description: "Сводка на сегодня: заезды, выезды, кому платить, уборки",
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
      name: "list_today_arrivals",
      description: "Кто заезжает сегодня",
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
      name: "list_today_departures",
      description: "Кто выезжает сегодня",
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
      name: "who_in_room",
      description: "Кто проживает в номере (по номеру комнаты)",
      parameters: {
        type: "object",
        properties: { hotelId: { type: "string" }, roomNumber: { type: "string" } },
        required: ["hotelId", "roomNumber"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_free_rooms_today",
      description: "Свободные места на сегодня",
      parameters: {
        type: "object",
        properties: { hotelId: { type: "string" }, nights: { type: "number" } },
        required: ["hotelId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_hk_tasks",
      description: "Список задач уборки",
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
      name: "list_services",
      description: "Каталог услуг для продажи",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_print_form_links",
      description: "Ссылки на печать бланков гостя",
      parameters: {
        type: "object",
        properties: { guestId: { type: "string" }, bookingId: { type: "string" } },
        required: ["guestId", "bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_passport_scan",
      description: "Попросить хомячка прислать фото паспорта в чат",
      parameters: {
        type: "object",
        properties: {
          guestId: { type: "string" },
          bookingId: { type: "string" },
          hint: { type: "string" },
        },
        required: ["guestId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_checkout",
      description: "Предложить выселить гостя",
      parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_relocate",
      description: "Предложить переселение",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          newRoomId: { type: "string" },
          newBedId: { type: "string" },
          roomNumber: { type: "string" },
        },
        required: ["bookingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_sale",
      description: "Предложить продажу услуги",
      parameters: {
        type: "object",
        properties: {
          hotelId: { type: "string" },
          serviceId: { type: "string" },
          serviceName: { type: "string" },
          qty: { type: "number" },
          bookingId: { type: "string" },
          guestName: { type: "string" },
        },
        required: ["hotelId", "serviceId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_encashment",
      description: "Предложить инкассацию",
      parameters: {
        type: "object",
        properties: { hotelId: { type: "string" }, amount: { type: "number" }, note: { type: "string" } },
        required: ["hotelId", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_cancel_booking",
      description: "Предложить отмену брони",
      parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_booking_service",
      description: "Предложить услугу к брони",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          serviceId: { type: "string" },
          qty: { type: "number" },
        },
        required: ["bookingId", "serviceId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_checkin",
      description: "Предложить заселение (форма гостя уже заполнена)",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          form: { type: "object" },
          paymentAmount: { type: "number" },
          paymentNights: { type: "number" },
          skipPayment: { type: "boolean" },
          migRegSubmitted: { type: "boolean" },
        },
        required: ["bookingId", "form"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_mig_reg",
      description: "Отметить подачу мигучёта",
      parameters: {
        type: "object",
        properties: { guestId: { type: "string" }, notifNumber: { type: "string" } },
        required: ["guestId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_hk_complete",
      description: "Отметить уборку выполненной",
      parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    },
  },
];

async function loadBooking(session: SessionPayload, bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: true, hotel: true, guest: true },
  });
}

export async function runHamsterExtraTool(
  session: SessionPayload,
  name: string,
  args: Record<string, unknown>
): Promise<{
  result: unknown;
  pendingAction?: PendingAction;
  fileRequest?: { docType: string; hint: string; guestId?: string; bookingId?: string };
  printLinks?: Array<{ label: string; url: string }>;
}> {
  switch (name) {
    case "get_morning_briefing":
      return { result: await getMorningBriefing(session, String(args.hotelId)) };

    case "list_today_arrivals":
      return { result: { arrivals: await listTodayArrivals(session, String(args.hotelId)) } };

    case "list_today_departures":
      return { result: { departures: await listTodayDepartures(session, String(args.hotelId)) } };

    case "who_in_room":
      return {
        result: {
          guests: await whoInRoom(session, String(args.hotelId), String(args.roomNumber ?? "")),
        },
      };

    case "list_free_rooms_today":
      return {
        result: await listFreeRoomsNow(
          session,
          String(args.hotelId),
          Math.max(1, Math.round(Number(args.nights) || 1))
        ),
      };

    case "list_hk_tasks":
      return { result: { tasks: await listHkTasks(session, String(args.hotelId)) } };

    case "list_services":
      return { result: { services: await listActiveServices(session) } };

    case "get_print_form_links": {
      const guestId = String(args.guestId);
      const bookingId = String(args.bookingId);
      const links = buildPrintFormUrls(guestId, bookingId);
      return { result: { links }, printLinks: links };
    }

    case "request_passport_scan":
      return {
        result: { status: "awaiting_upload" },
        fileRequest: {
          docType: "passport",
          hint: String(args.hint ?? "Пришли фото паспорта — я прочитаю данные 📷"),
          guestId: args.guestId ? String(args.guestId) : undefined,
          bookingId: args.bookingId ? String(args.bookingId) : undefined,
        },
      };

    case "propose_checkout": {
      const booking = await loadBooking(session, String(args.bookingId));
      if (!booking || booking.hotel.seatId !== session.seatId) {
        return { result: { error: "Бронь не найдена" } };
      }
      if (booking.status !== "checkedin") {
        return { result: { error: "Гость не заселён" } };
      }
      const preview = `Выселение: ${booking.guestName}\n№${booking.room.number}\nВыезд ${fmtDate(booking.checkOut)}`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "checkout",
          preview,
          payload: { bookingId: booking.id },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_relocate": {
      const booking = await loadBooking(session, String(args.bookingId));
      if (!booking || booking.hotel.seatId !== session.seatId) {
        return { result: { error: "Бронь не найдена" } };
      }
      let newRoomId = args.newRoomId ? String(args.newRoomId) : "";
      let newBedId = args.newBedId ? String(args.newBedId) : undefined;

      if (!newRoomId && args.roomNumber) {
        const room = await prisma.room.findFirst({
          where: { hotelId: booking.hotelId, number: String(args.roomNumber) },
        });
        if (room) newRoomId = room.id;
      }

      if (!newRoomId) {
        const avail = await findAvailableRooms({
          hotelId: booking.hotelId,
          checkIn: mskDateKey(booking.checkIn),
          checkOut: mskDateKey(booking.checkOut),
          guestGender: booking.guest?.gender ?? null,
          limit: 5,
        });
        const pick = avail.rooms[0];
        if (!pick) return { result: { error: "Нет свободных мест" } };
        newRoomId = pick.roomId;
        newBedId = pick.bedId ?? undefined;
      }

      const newRoom = await prisma.room.findUnique({ where: { id: newRoomId } });
      const placeLabel =
        newBedId && newRoom?.kind === "dorm"
          ? formatDormPlaceLabel(newRoom.number, (await prisma.bed.findUnique({ where: { id: newBedId } }))?.label ?? "")
          : newRoom?.number ?? "?";

      const preview = `Переселение: ${booking.guestName}\nИз №${booking.room.number} → №${placeLabel}`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "relocate",
          preview,
          payload: { bookingId: booking.id, newRoomId, newBedId },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_sale": {
      const hotelId = String(args.hotelId);
      let serviceId = args.serviceId ? String(args.serviceId) : "";
      if (!serviceId && args.serviceName) {
        const svc = await prisma.service.findFirst({
          where: {
            seatId: session.seatId!,
            active: true,
            name: { contains: String(args.serviceName), mode: "insensitive" },
          },
        });
        if (svc) serviceId = svc.id;
      }
      const service = await prisma.service.findFirst({
        where: { id: serviceId, seatId: session.seatId!, active: true },
      });
      if (!service) return { result: { error: "Услуга не найдена" } };

      const qty = Math.max(1, Math.round(Number(args.qty) || 1));
      const amount = service.price * qty;
      const preview = `Продажа: ${service.name} × ${qty} = ${amount} ₽` +
        (args.guestName ? `\nГость: ${args.guestName}` : "");

      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "sale",
          preview,
          payload: {
            hotelId,
            serviceId: service.id,
            qty,
            bookingId: args.bookingId,
            guestName: args.guestName,
          },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_encashment": {
      const amount = Math.round(Number(args.amount) || 0);
      if (amount <= 0) return { result: { error: "Укажите сумму" } };
      const preview = `Инкассация: ${amount} ₽`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "encashment",
          preview,
          payload: { hotelId: args.hotelId, amount, note: args.note ?? "" },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_cancel_booking": {
      const booking = await loadBooking(session, String(args.bookingId));
      if (!booking || booking.hotel.seatId !== session.seatId) {
        return { result: { error: "Бронь не найдена" } };
      }
      const preview = `Отмена брони: ${booking.guestName}\n№${booking.room.number}\n${fmtDate(booking.checkIn)} — ${fmtDate(booking.checkOut)}`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "cancel_booking",
          preview,
          payload: { bookingId: booking.id },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_booking_service": {
      const booking = await loadBooking(session, String(args.bookingId));
      if (!booking || booking.hotel.seatId !== session.seatId) {
        return { result: { error: "Бронь не найдена" } };
      }
      const service = await prisma.service.findFirst({
        where: { id: String(args.serviceId), seatId: session.seatId!, active: true },
      });
      if (!service) return { result: { error: "Услуга не найдена" } };
      const qty = Math.max(1, Math.round(Number(args.qty) || 1));
      const amount = service.price * qty;
      const preview = `${booking.guestName}, №${booking.room.number}\n${service.name} × ${qty} = ${amount} ₽`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "booking_service",
          preview,
          payload: { bookingId: booking.id, serviceId: service.id, qty },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_checkin": {
      const booking = await loadBooking(session, String(args.bookingId));
      if (!booking || booking.hotel.seatId !== session.seatId) {
        return { result: { error: "Бронь не найдена" } };
      }
      const form = args.form as Record<string, unknown>;
      const guestName = [form.lastName, form.firstName].filter(Boolean).join(" ") || booking.guestName;
      const payAmount = args.skipPayment ? 0 : Math.round(Number(args.paymentAmount) || 0);
      const preview =
        `Заселение: ${guestName}\n№${booking.room.number}\n` +
        `${fmtDate(booking.checkIn)} — ${fmtDate(booking.checkOut)}` +
        (payAmount > 0 ? `\nОплата: ${payAmount} ₽` : "\nБез оплаты сейчас");

      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "checkin",
          preview,
          payload: {
            bookingId: booking.id,
            form: args.form,
            regCardSigned: true,
            paymentAmount: payAmount,
            paymentNights: args.paymentNights,
            skipPayment: Boolean(args.skipPayment),
            migRegSubmitted: Boolean(args.migRegSubmitted),
          },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_mig_reg": {
      const guest = await prisma.guest.findFirst({
        where: { id: String(args.guestId), seatId: session.seatId! },
      });
      if (!guest) return { result: { error: "Гость не найден" } };
      const preview = `Мигучёт подан: ${guest.name}` +
        (args.notifNumber ? `\n№ ${args.notifNumber}` : "");
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "mig_reg",
          preview,
          payload: { guestId: guest.id, notifNumber: args.notifNumber ?? "" },
          createdAt: new Date().toISOString(),
        },
      };
    }

    case "propose_hk_complete": {
      const task = await prisma.hkTask.findUnique({
        where: { id: String(args.taskId) },
        include: { hotel: true },
      });
      if (!task || task.hotel.seatId !== session.seatId) {
        return { result: { error: "Задача не найдена" } };
      }
      const preview = `Уборка выполнена: №${task.roomNumber} (${task.type})`;
      return {
        result: { status: "awaiting_confirmation", preview },
        pendingAction: {
          type: "hk_complete",
          preview,
          payload: { taskId: task.id },
          createdAt: new Date().toISOString(),
        },
      };
    }

    default:
      return { result: { error: `Неизвестный инструмент: ${name}` } };
  }
}

export async function runHamsterTool(
  session: SessionPayload,
  name: string,
  args: Record<string, unknown>
): Promise<{
  result: unknown;
  pendingAction?: PendingAction;
  fileRequest?: { docType: string; hint: string; guestId?: string; bookingId?: string };
  printLinks?: Array<{ label: string; url: string }>;
}> {
  const extraNames = new Set(HAMSTER_EXTRA_TOOLS.map((t) => t.function.name));
  if (extraNames.has(name)) {
    return runHamsterExtraTool(session, name, args);
  }
  const base = await runAssistantTool(session, name, args);
  return base;
}
