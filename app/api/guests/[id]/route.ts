import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { guestUpdatePayload, formDisplayName } from "@/lib/guest-form";
import { apiErrorMessage } from "@/lib/api-error";
import { deleteStoredFile } from "@/lib/object-storage.server";
import type { GuestFormData } from "@/lib/guest-form";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guest = await prisma.guest.findFirst({
    where: { id: params.id, seatId: session.seatId },
  });
  if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

  const body = await req.json();
  const { form, regCardSigned, vip, isForeigner: isForeignerPatch, bookingId } = body as {
    form?: GuestFormData;
    regCardSigned?: boolean;
    vip?: boolean;
    isForeigner?: boolean;
    bookingId?: string;
  };

  if (!form) {
    return NextResponse.json({ error: "Нет данных формы" }, { status: 400 });
  }

  const payload = guestUpdatePayload(form, isForeignerPatch ?? guest.isForeigner);
  const resolvedGuestName = formDisplayName(form) || payload.name;

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.guest.update({
      where: { id: guest.id },
      data: {
        ...payload,
        name: resolvedGuestName,
        ...(isForeignerPatch !== undefined ? { isForeigner: isForeignerPatch } : {}),
        ...(regCardSigned !== undefined ? { regCardSigned } : {}),
        ...(vip !== undefined ? { vip } : {}),
        visa: payload.visa ? payload.visa : Prisma.JsonNull,
        migrationCard: payload.migrationCard ? payload.migrationCard : Prisma.JsonNull,
      },
      include: { documents: true },
    }),
  ];

  if (bookingId) {
    ops.push(
      prisma.booking.updateMany({
        where: {
          guestId: guest.id,
          id: bookingId,
          hotel: { seatId: session.seatId },
          status: { in: ["new", "confirmed", "checkedin"] },
        },
        data: { guestName: resolvedGuestName },
      })
    );
  }

  const [updated] = await prisma.$transaction(ops);

  return NextResponse.json({ ok: true, guest: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertCanManage(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const guest = await prisma.guest.findFirst({
      where: { id: params.id, seatId: auth.session.seatId },
      include: {
        documents: true,
        bookings: { where: { status: { not: "cancelled" } }, take: 1 },
      },
    });
    if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

    if (guest.bookings.length > 0) {
      return NextResponse.json(
        { error: "Нельзя удалить гостя с бронированиями. Отмените или завершите все бронирования." },
        { status: 400 }
      );
    }

    for (const doc of guest.documents) {
      await deleteStoredFile(doc.filePath);
    }

    await prisma.guest.delete({ where: { id: guest.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[guests DELETE]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось удалить гостя") },
      { status: 500 }
    );
  }
}
