import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { executePendingAction } from "@/lib/assistant/execute.server";
import type { PendingAction } from "@/lib/assistant/types";
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
    const conversationId = String(body.conversationId ?? "");
    const confirmed = Boolean(body.confirmed);

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId обязателен" }, { status: 400 });
    }

    const staff = await prisma.staff.findFirst({
      where: { userId: auth.session.userId, seatId: auth.session.seatId },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Профиль сотрудника не найден" }, { status: 403 });
    }

    const conversation = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, seatId: auth.session.seatId, staffId: staff.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
    }

    const pendingAction = conversation.pendingAction as PendingAction | null;
    if (!pendingAction) {
      return NextResponse.json({ error: "Нет операции для подтверждения" }, { status: 400 });
    }

    if (!confirmed) {
      await prisma.assistantConversation.update({
        where: { id: conversationId },
        data: { pendingAction: Prisma.DbNull },
      });
      await prisma.assistantMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: "Операция отменена.",
        },
      });
      return NextResponse.json({ ok: true, cancelled: true, reply: "Операция отменена." });
    }

    const result = await executePendingAction(auth.session, pendingAction, {
      paymentMethod: body.paymentMethod ? String(body.paymentMethod) : undefined,
      channelId: body.channelId ? String(body.channelId) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { pendingAction: Prisma.DbNull },
    });

    await prisma.assistantMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: result.message,
        metadata: { executed: pendingAction.type },
      },
    });

    return NextResponse.json({ ok: true, reply: result.message });
  } catch (e) {
    console.error("[assistant/confirm]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось выполнить операцию") },
      { status: 500 }
    );
  }
}
