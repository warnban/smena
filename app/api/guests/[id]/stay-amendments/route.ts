import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!guest) {
      return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
    }

    const amendments = await prisma.stayAmendment.findMany({
      where: { booking: { guestId: guest.id, hotel: { seatId: session.seatId } } },
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            id: true,
            guestName: true,
            roomId: true,
            hotelId: true,
            checkOut: true,
            amount: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, amendments });
  } catch (e) {
    console.error("[stay-amendments]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось загрузить доп. соглашения") }, { status: 500 });
  }
}
