import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aitunnelChatCompletion, type ChatMessage } from "@/lib/aitunnel.server";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant/tools.server";
import { getNetworkFaq } from "@/lib/assistant/faq.server";
import type { AssistantChatResponse, PendingAction } from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import { mskDateKey } from "@/lib/msk-time";

const MAX_TOOL_ROUNDS = 10;
const HISTORY_LIMIT = 24;

/** Админ просит применить продление, а не только узнать цену. */
function userWantsExtendApply(text: string): boolean {
  const m = text.toLowerCase();
  if (/^(сколько|какая\s+сумма|цена|расч[её]т)\b/.test(m) && !/продл|измен|сделай/.test(m)) {
    return false;
  }
  return /продл|измен(ить|и)?\s*(срок|выезд|дату)|нов(ый|ая|ую)\s+выезд|ещё\s*\d+|на\s+\d+\s*(ден|дн|ноч|сут)|\+\s*\d+\s*(ден|дн|ноч)/i.test(
    m
  );
}

/** Ответ модели утверждает, что операция уже выполнена. */
function replyClaimsDone(text: string): boolean {
  return /(?:продлил|изменил|обновил|установил|сделал|готово|выполнен|выезд\s+(?:теперь|установлен|изменён))/i.test(
    text
  );
}

function buildSystemPrompt(hotelId: string, hotelName: string | null): string {
  const today = mskDateKey();
  return `Ты AI-помощник администраторов гостиницы в CRM «Смена».

Правила:
1. Отвечай по-русски, коротко и по делу. Без markdown: не используй **, ## и нумерованные анкеты.
2. Админ пишет свободно («Петров, 17 июня на 3 дня, любой номер, рф») — сам извлекай ФИО, даты, гражданство. Уточняй только если не хватает критичного (нет имени или дат).
3. «рф», «россия», «рос» — гость не иностранец (isForeigner: false). «иностр», «foreign» — иностранец.
4. Сегодня по Москве: ${today}. Относительные даты («17 июня», «завтра», «на 3 дня») переводи в YYYY-MM-DD.
5. FAQ — search_faq. Если пуст — скажи, что заполняют в Настройки → Система.
6. Суммы и статусы — только через инструменты quote_* и get_*. Не придумывай цифры.
7. Оплаты, продление, возврат, брони — только propose_*; админ подтверждает на экране. Бронь/срок меняются ТОЛЬКО после «Подтвердить».
8. Продление: для применения — propose_extend_stay (не quote_extend_stay). quote_extend_stay — только если спросили «сколько стоит».
9. Никогда не пиши «готово», «продлил», «выезд изменён» — пока админ не подтвердил. После propose_* скажи: подтвердите карточку ниже.
10. В отеле есть отдельные номера и общие комнаты с койко-местами (dorm). В общей комнате бронь всегда на койко-место (1/01, 1/02…) — передай bedId или bedNumber. Нельзя бронировать «комнату Общая» без койки.
11. find_available_rooms: kind=dorm → в propose_create_booking обязательно bedId (или bedNumber). kind=private → roomId или roomNumber.
12. Бронь без места: find_available_rooms с guestId/guestGender, затем propose_create_booking с bedId для койки. Не предлагай мужчинам женские комнаты и наоборот.
13. Заселение с документами — модалка «Заселить» на шахматке.
14. hotelId: ${hotelId || "не выбран — попроси выбрать отель в шапке"}. Отель: ${hotelName ?? "не выбран"}.

Не показывай внутренние ID. Не перечисляй поля анкетой — действуй по смыслу сообщения.`;
}

async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

export async function runAssistantChat(params: {
  session: SessionPayload;
  staffId: string;
  hotelId: string;
  hotelName: string | null;
  conversationId?: string;
  message: string;
}): Promise<AssistantChatResponse> {
  const { session, staffId, hotelId, hotelName, message } = params;
  const seatId = session.seatId!;

  let conversationId = params.conversationId;
  if (conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, seatId, staffId },
    });
    if (!existing) {
      conversationId = undefined;
    }
  }

  if (!conversationId) {
    const conv = await prisma.assistantConversation.create({
      data: { seatId, staffId, hotelId },
    });
    conversationId = conv.id;
  } else if (hotelId) {
    await prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { hotelId },
    });
  }

  await prisma.assistantMessage.create({
    data: { conversationId, role: "user", content: message.trim() },
  });

  const faq = await getNetworkFaq(seatId);
  const faqEmpty = !faq?.content.trim();

  const history = await loadHistory(conversationId);
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(hotelId, hotelName) },
    ...history,
  ];

  let pendingAction: PendingAction | undefined;
  let reply = "";
  let lastQuoteExtendArgs: Record<string, unknown> | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await aitunnelChatCompletion({
      messages,
      tools: ASSISTANT_TOOLS,
    });

    if (completion.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: completion.content ?? "",
      });

      let extendProposedThisRound = false;

      for (const call of completion.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        if (hotelId && !args.hotelId && call.function.name !== "search_faq" && call.function.name !== "find_guests") {
          args.hotelId = hotelId;
        }

        const toolResult = await runAssistantTool(session, call.function.name, args);
        if (toolResult.pendingAction) {
          pendingAction = toolResult.pendingAction;
          if (toolResult.pendingAction.type === "extend_stay") {
            extendProposedThisRound = true;
          }
        }

        if (call.function.name === "propose_extend_stay") {
          extendProposedThisRound = true;
        }

        if (call.function.name === "quote_extend_stay") {
          const r = toolResult.result as Record<string, unknown>;
          if (!r.error) {
            lastQuoteExtendArgs = args;
          }
        }

        messages.push({
          role: "user",
          content: `[tool:${call.function.name}] ${JSON.stringify(toolResult.result)}`,
        });
      }

      if (
        !extendProposedThisRound &&
        !pendingAction &&
        lastQuoteExtendArgs &&
        userWantsExtendApply(message)
      ) {
        const proposal = await runAssistantTool(session, "propose_extend_stay", lastQuoteExtendArgs);
        messages.push({
          role: "user",
          content: `[tool:propose_extend_stay] ${JSON.stringify(proposal.result)}`,
        });
        if (proposal.pendingAction) {
          pendingAction = proposal.pendingAction;
        }
      }

      if (pendingAction) break;
      continue;
    }

    reply = (completion.content ?? "").trim();
    if (!reply) {
      reply = "Не удалось сформировать ответ. Попробуйте переформулировать вопрос.";
    }
    break;
  }

  if (pendingAction) {
    reply = "Проверьте данные и подтвердите операцию ниже.";
  } else if (replyClaimsDone(reply) && userWantsExtendApply(message)) {
    reply =
      "Изменение срока ещё не применено — нужна карточка подтверждения. Повторите запрос, например: «продли Петрова на 3 дня».";
  } else if (!reply && !pendingAction) {
    reply = "Не удалось обработать запрос. Попробуйте ещё раз.";
  }

  await prisma.assistantMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: reply,
      metadata: pendingAction
        ? ({ pendingAction } as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  await prisma.assistantConversation.update({
    where: { id: conversationId },
    data: {
      pendingAction: pendingAction
        ? (pendingAction as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });

  const response: AssistantChatResponse = {
    conversationId,
    reply,
    faqEmpty: faqEmpty && message.toLowerCase().includes("faq"),
  };

  if (pendingAction) {
    const paymentMethods = await ensurePaymentMethods(seatId);
    const needsPaymentMethod =
      pendingAction.type === "record_payment" || pendingAction.type === "process_refund";
    const payload = pendingAction.payload;

    if (payload.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: String(payload.bookingId) },
        include: { room: true },
      });
      if (booking) {
        response.confirmation = {
          pendingAction,
          needsPaymentMethod,
          paymentMethods: needsPaymentMethod
            ? paymentMethods.filter((m) => m.active).map((m) => ({ code: m.code, label: m.label }))
            : undefined,
          bookingLink: {
            bookingId: booking.id,
            guestName: booking.guestName,
            roomNumber: booking.room.number,
          },
        };
        return response;
      }
    }

    response.confirmation = {
      pendingAction,
      needsPaymentMethod,
      paymentMethods: needsPaymentMethod
        ? paymentMethods.filter((m) => m.active).map((m) => ({ code: m.code, label: m.label }))
        : undefined,
    };
  }

  return response;
}
