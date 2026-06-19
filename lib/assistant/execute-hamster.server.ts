import "server-only";

import { prisma } from "@/lib/prisma";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { assertHotelWrite } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { findAvailableRooms } from "@/lib/booking-availability.server";
import { guestGenderMatchesDorm, setBedStatus, formatBedDisplay, formatDormPlaceLabel } from "@/lib/dorm.server";
import { HK_CATEGORY_TYPES, hkTimeNow, formatHkPlaceLabel, startOfDay } from "@/lib/housekeeping";
import { mskDateKey } from "@/lib/msk-time";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { performCheckIn, type PerformCheckInInput } from "@/lib/checkin.server";
import type { GuestFormData } from "@/lib/guest-form";
import type { SessionPayload } from "@/lib/auth";

export async function executeCheckout(
  session: SessionPayload,
  payload: Record<string, unknown>
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const booking = auth.booking;
  const bed = booking.bedId ? await prisma.bed.findUnique({ where: { id: booking.bedId } }) : null;
  const roomNumber = bed ? formatHkPlaceLabel(booking.room.number, bed.label) : booking.room.number;
  const now = new Date();
  const time = hkTimeNow();

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "checkedout", checkedOutAt: now },
    }),
    ...(booking.bedId
      ? []
      : [prisma.room.update({ where: { id: booking.roomId }, data: { status: "cleaning" } })]),
    prisma.hkTask.create({
      data: {
        hotelId: booking.hotelId,
        roomId: booking.roomId,
        bedId: booking.bedId,
        bookingId: booking.id,
        roomNumber,
        type: HK_CATEGORY_TYPES.checkout,
        category: "checkout",
        assignee: "—",
        priority: "high",
        status: "pending",
        time,
        est: "60 мин",
      },
    }),
  ]);

  if (booking.bedId) {
    await setBedStatus(booking.bedId, "cleaning");
  }

  return { ok: true, message: `${booking.guestName} выписан из №${roomNumber}. Уборка поставлена ✨` };
}

export async function executeRelocate(
  session: SessionPayload,
  payload: Record<string, unknown>
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const bookingId = String(payload.bookingId ?? "");
  const newRoomId = String(payload.newRoomId ?? "");
  const newBedIdIn = payload.newBedId ? String(payload.newBedId) : null;

  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const booking = auth.booking;
  const today = startOfDay(new Date());
  if (booking.status !== "checkedin" || booking.checkOut < today) {
    return { ok: false, error: "Гость не проживает в отеле" };
  }

  if (!newRoomId) return { ok: false, error: "Выберите номер для переселения" };

  const newRoom = await prisma.room.findFirst({
    where: { id: newRoomId, hotelId: booking.hotelId },
    include: { beds: true },
  });
  if (!newRoom) return { ok: false, error: "Номер не найден" };

  const guest = await prisma.guest.findUnique({ where: { id: booking.guestId } });
  const oldRoomId = booking.roomId;
  const oldBedId = booking.bedId;
  const checkInKey = mskDateKey(booking.checkIn);
  const checkOutKey = mskDateKey(booking.checkOut);

  const available = await findAvailableRooms({
    hotelId: booking.hotelId,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    guestGender: guest?.gender ?? null,
    limit: 200,
  });

  let targetBedId: string | null = null;

  if (newRoom.kind === "dorm") {
    if (!guestGenderMatchesDorm(guest?.gender, newRoom.dormGender)) {
      return { ok: false, error: "Пол гостя не подходит для общей комнаты" };
    }
    const slotsInRoom = available.rooms.filter((s) => s.roomId === newRoomId && s.bedId);
    if (!slotsInRoom.length) return { ok: false, error: "Нет свободных койко-мест" };
    if (newBedIdIn) {
      if (!slotsInRoom.some((s) => s.bedId === newBedIdIn)) {
        return { ok: false, error: "Койко-место занято" };
      }
      targetBedId = newBedIdIn;
    } else {
      const pick = slotsInRoom.find((s) => s.bedId !== oldBedId);
      if (!pick?.bedId) return { ok: false, error: "Выберите свободную койку" };
      targetBedId = pick.bedId;
    }
  } else {
    if (!available.rooms.some((s) => s.roomId === newRoomId && !s.bedId)) {
      return { ok: false, error: `Номер ${newRoom.number} занят` };
    }
  }

  const oldBed = oldBedId ? await prisma.bed.findUnique({ where: { id: oldBedId } }) : null;
  const newBed = targetBedId ? newRoom.beds.find((b) => b.id === targetBedId) : null;
  const oldRoomNumber = formatHkPlaceLabel(booking.room.number, oldBed?.label);
  const newPlaceLabel = newBed
    ? formatDormPlaceLabel(newRoom.number, newBed.label)
    : newRoom.number;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { roomId: newRoomId, bedId: targetBedId },
    }),
    prisma.hkTask.create({
      data: {
        hotelId: booking.hotelId,
        roomId: oldRoomId,
        bedId: oldBedId,
        bookingId: booking.id,
        roomNumber: oldRoomNumber,
        type: HK_CATEGORY_TYPES.relocation,
        category: "relocation",
        assignee: "—",
        priority: "high",
        status: "pending",
        time: hkTimeNow(),
        est: "60 мин",
      },
    }),
  ]);

  if (oldBedId) await setBedStatus(oldBedId, "cleaning");
  else await prisma.room.update({ where: { id: oldRoomId }, data: { status: "cleaning" } });

  if (targetBedId) await setBedStatus(targetBedId, "occupied");
  else await prisma.room.update({ where: { id: newRoomId }, data: { status: "occupied" } });

  return {
    ok: true,
    message: `${booking.guestName} переселён: ${oldRoomNumber} → ${newPlaceLabel}`,
  };
}

export async function executeSale(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string }
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const hotelId = String(payload.hotelId ?? "");
  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) return { ok: false, error: payLock.error };

  const serviceId = String(payload.serviceId ?? "");
  const qty = Math.max(1, Math.round(Number(payload.qty) || 1));
  const paymentMethod = String(opts.paymentMethod ?? payload.paymentMethod ?? "cash");
  const bookingId = payload.bookingId ? String(payload.bookingId) : null;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, seatId: auth.session.seatId, active: true, kind: "service" },
  });
  if (!service) return { ok: false, error: "Услуга не найдена" };

  const amount = service.price * qty;
  let guestName: string | null = payload.guestName ? String(payload.guestName) : null;
  let roomNumber: string | null = null;

  if (bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      include: { room: true },
    });
    if (booking) {
      guestName = booking.guestName;
      roomNumber = booking.room.number;
    }
  }

  await prisma.$transaction([
    prisma.serviceSale.create({
      data: {
        hotelId,
        bookingId,
        serviceId: service.id,
        guestName: guestName ?? "",
        serviceName: service.name,
        serviceCategory: service.category,
        qty,
        amount,
        paymentMethod,
      },
    }),
    prisma.transaction.create({
      data: {
        hotelId,
        type: "service",
        category: service.category,
        paymentMethod,
        amount,
        bookingId,
        guestName,
        roomNumber,
        note: payload.note ? String(payload.note) : null,
      },
    }),
  ]);

  return { ok: true, message: `Продажа: ${service.name} × ${qty} = ${amount} ₽` };
}

export async function executeEncashment(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string }
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const hotelId = String(payload.hotelId ?? "");
  const amount = Math.round(Number(payload.amount) || 0);
  if (!amount || amount <= 0) return { ok: false, error: "Некорректная сумма" };

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const dateResolved = resolveTransactionDateInput(
    auth.session.role,
    (payload.date ?? payload.operationDate) as string | undefined
  );
  if (!dateResolved.ok) return { ok: false, error: dateResolved.error };

  const payLock = await assertPaymentOperationAllowed(hotelId, auth.session.role, dateResolved.dateKey);
  if (!payLock.ok) return { ok: false, error: payLock.error };

  await prisma.transaction.create({
    data: {
      hotelId,
      type: "encashment",
      category: "encashment",
      paymentMethod: String(opts.paymentMethod ?? payload.paymentMethod ?? "cash"),
      amount,
      date: dateResolved.date,
      note: payload.note ? String(payload.note) : "Инкассация",
    },
  });

  return { ok: true, message: `Инкассация ${amount} ₽ проведена` };
}

export async function executeCancelBooking(
  session: SessionPayload,
  payload: Record<string, unknown>
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (auth.booking.status === "checkedin") {
    return { ok: false, error: "Нельзя отменить проживание заселённого гостя" };
  }

  await prisma.booking.update({
    where: { id: auth.booking.id },
    data: { status: "cancelled" },
  });

  return { ok: true, message: `Бронь ${auth.booking.guestName} отменена` };
}

export async function executeBookingService(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string }
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const payLock = await assertPaymentsOpen(auth.booking.hotelId);
  if (!payLock.ok) return { ok: false, error: payLock.error };

  const service = await prisma.service.findFirst({
    where: { id: String(payload.serviceId), seatId: auth.session.seatId, active: true },
  });
  if (!service) return { ok: false, error: "Услуга не найдена" };

  const qty = Math.max(1, Math.round(Number(payload.qty) || 1));
  const amount = service.price * qty;
  const method = String(opts.paymentMethod ?? payload.paymentMethod ?? "cash");

  await prisma.$transaction([
    prisma.serviceSale.create({
      data: {
        hotelId: auth.booking.hotelId,
        bookingId: auth.booking.id,
        serviceId: service.id,
        guestName: auth.booking.guestName,
        serviceName: service.name,
        serviceCategory: service.category,
        qty,
        amount,
        paymentMethod: method,
      },
    }),
    prisma.transaction.create({
      data: {
        hotelId: auth.booking.hotelId,
        type: "service",
        category: service.category,
        paymentMethod: method,
        amount,
        bookingId: auth.booking.id,
        guestName: auth.booking.guestName,
        roomNumber: auth.booking.room.number,
      },
    }),
  ]);

  return { ok: true, message: `${service.name} × ${qty} = ${amount} ₽ для ${auth.booking.guestName}` };
}

export async function executeCheckIn(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string; channelId?: string }
): Promise<{ ok: true; message: string; guestId?: string; bookingId?: string } | { ok: false; error: string }> {
  const bookingId = String(payload.bookingId ?? "");
  const input: PerformCheckInInput = {
    form: payload.form as GuestFormData,
    regCardSigned: Boolean(payload.regCardSigned ?? true),
    migRegSubmitted: Boolean(payload.migRegSubmitted),
    migRegNotifNumber: payload.migRegNotifNumber ? String(payload.migRegNotifNumber) : undefined,
    paymentMethod: opts.paymentMethod ?? (payload.paymentMethod ? String(payload.paymentMethod) : "cash"),
    paymentAmount: payload.paymentAmount != null ? Number(payload.paymentAmount) : undefined,
    paymentNights: payload.paymentNights != null ? Number(payload.paymentNights) : undefined,
    paidThroughDate: payload.paidThroughDate ? String(payload.paidThroughDate) : undefined,
    note: payload.note ? String(payload.note) : undefined,
    skipPayment: Boolean(payload.skipPayment),
    channelId: opts.channelId ?? (payload.channelId ? String(payload.channelId) : undefined),
    discountRuleId: payload.discountRuleId ? String(payload.discountRuleId) : undefined,
  };

  const result = await performCheckIn(session, bookingId, input);
  if (!result.ok) return result;

  return {
    ok: true,
    message: `Гость заселён! Оплачено ${result.paid} ₽ из ${result.amount} ₽ 🎉`,
    guestId: result.guestId,
    bookingId,
  };
}

export async function executeMigReg(
  session: SessionPayload,
  payload: Record<string, unknown>
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const guestId = String(payload.guestId ?? "");
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, seatId: session.seatId! },
  });
  if (!guest) return { ok: false, error: "Гость не найден" };
  if (!guest.isForeigner) return { ok: false, error: "Мигучёт не требуется" };

  const now = new Date();
  const submittedAt = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const notifNumber = payload.notifNumber ? String(payload.notifNumber).trim() : "";

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      migRegStatus: "submitted",
      migRegSubmittedAt: submittedAt,
      ...(notifNumber ? { migRegNotifNumber: notifNumber } : {}),
    },
  });

  return { ok: true, message: `Мигучёт для ${guest.name} отмечен как подан ✅` };
}

export async function executeHkComplete(
  session: SessionPayload,
  payload: Record<string, unknown>
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const taskId = String(payload.taskId ?? "");
  const task = await prisma.hkTask.findUnique({
    where: { id: taskId },
    include: { hotel: true, booking: true },
  });
  if (!task || task.hotel.seatId !== session.seatId) {
    return { ok: false, error: "Задача не найдена" };
  }

  await prisma.hkTask.update({
    where: { id: task.id },
    data: { status: "done", completedAt: new Date() },
  });

  const guestStillThere =
    task.category === "scheduled" &&
    task.booking &&
    task.booking.status === "checkedin" &&
    task.booking.checkOut >= new Date(new Date().setHours(0, 0, 0, 0));

  if (task.bedId) {
    await setBedStatus(task.bedId, guestStillThere ? "occupied" : "available");
  } else if (task.roomId) {
    await prisma.room.update({
      where: { id: task.roomId },
      data: { status: guestStillThere ? "occupied" : "available" },
    });
  }

  return { ok: true, message: `Уборка №${task.roomNumber} выполнена ✨` };
}
