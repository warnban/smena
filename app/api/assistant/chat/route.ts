import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { runHamsterChat } from "@/lib/assistant/hamster-agent.server";
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
    const mode = String(body.mode ?? "hamster");

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

    if (mode === "hamster") {
      const message = body.message != null ? String(body.message) : "";
      const intent = body.intent ? String(body.intent) : body.buttonId ? String(body.buttonId) : undefined;

      if (!message.trim() && !intent && !body.reset && !body.conversationId) {
        if (!hotelId || hotelId === "all") {
          return NextResponse.json({ error: "Выберите отель в шапке" }, { status: 400 });
        }
      }

      const result = await runHamsterChat({
        session: auth.session,
        staffId: staff.id,
        hotelId: hotelId && hotelId !== "all" ? hotelId : "",
        hotelName,
        conversationId: body.conversationId ? String(body.conversationId) : undefined,
        message: message.trim() || undefined,
        intent,
        buttonId: body.buttonId ? String(body.buttonId) : undefined,
        reset: Boolean(body.reset),
      });
      return NextResponse.json(result);
    }

    const message = String(body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
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
