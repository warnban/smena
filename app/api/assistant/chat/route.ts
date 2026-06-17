import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { runAssistantChat } from "@/lib/assistant/agent.server";
import { apiErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const message = String(body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
    }

    const staff = await prisma.staff.findFirst({
      where: { userId: auth.session.userId, seatId: auth.session.seatId },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Профиль сотрудника не найден" }, { status: 403 });
    }

    const hotelId = body.hotelId ? String(body.hotelId) : "";
    let hotelName: string | null = null;
    if (hotelId && hotelId !== "all") {
      const hotel = await prisma.hotel.findFirst({
        where: { id: hotelId, seatId: auth.session.seatId },
        select: { name: true },
      });
      hotelName = hotel?.name ?? null;
    }

    const result = await runAssistantChat({
      session: auth.session,
      staffId: staff.id,
      hotelId: hotelId && hotelId !== "all" ? hotelId : "",
      hotelName,
      conversationId: body.conversationId ? String(body.conversationId) : undefined,
      message,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[assistant/chat]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось получить ответ помощника") },
      { status: 500 }
    );
  }
}
