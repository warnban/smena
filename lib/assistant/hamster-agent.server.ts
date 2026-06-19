import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aitunnelChatCompletion, aitunnelHamsterModel, type ChatMessage } from "@/lib/aitunnel.server";
import { ASSISTANT_TOOLS } from "@/lib/assistant/tools.server";
import { HAMSTER_EXTRA_TOOLS, runHamsterTool } from "@/lib/assistant/hamster-tools.server";
import {
  HAMSTER_MAIN_ACTIONS,
  emptyHamsterWorkflow,
  parseWorkflowState,
  startWorkflow,
  workflowContextPrompt,
} from "@/lib/assistant/hamster-workflows";
import {
  buildMorningBriefingText,
  getMorningBriefing,
} from "@/lib/assistant/queries.server";
import type {
  HamsterChatResponse,
  HamsterChoice,
  HamsterFileRequest,
  HamsterQuickAction,
  PendingAction,
} from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import { mskDateKey } from "@/lib/msk-time";

const HAMSTER_TOOLS = [...ASSISTANT_TOOLS, ...HAMSTER_EXTRA_TOOLS];
const MAX_TOOL_ROUNDS = 12;
const HISTORY_LIMIT = 24;

function buildHamsterSystemPrompt(hotelId: string, hotelName: string | null, workflowExtra: string): string {
  const today = mskDateKey();
  return `Ты AI-помощник администратора гостиницы в CRM «Смена». Режим «Хомячок».

КРИТИЧЕСКИ ВАЖНО — стиль общения:
1. Обращайся к администратору ТОЛЬКО «Хомячок» (1–2 раза на сообщение).
2. Говори просто, как с ребёнком 10 лет: короткие фразы, без канцелярита и сложных слов.
3. «Бронь» → «запись на номер», «транзакция» → «оплата», «checkout» → «выезд».
4. Без markdown (** ## списки). Можно немного эмодзи 🐹
5. Задавай ОДИН вопрос за раз. Предлагай кнопки через инструменты, не перечисляй длинные анкеты.

Правила работы:
1. Сегодня (МСК): ${today}. Отель: ${hotelName ?? "не выбран"}. hotelId: ${hotelId || "нет — попроси выбрать отель"}.
2. FAQ — search_faq. Суммы — только quote_* и get_*. Не выдумывай цифры.
3. Любые изменения в базе — только propose_* → хомячок подтверждает карточкой. НИКОГДА не пиши «готово/сделал» до подтверждения.
4. Заселение: если новый гость или пустая анкета — request_passport_scan, потом propose_checkin.
5. Общие комнаты (dorm): бронь и заселение только на койко-место (bedId/bedNumber 1/01).
6. После заселения — get_print_form_links и скажи что бланки откроются в новой вкладке.
7. Утром можно get_morning_briefing. Кто в номере — who_in_room. Свободные — list_free_rooms_today.
8. «рф/россия» → не иностранец. «иностр/foreign» → иностранец.
9. Не показывай внутренние ID хомячку.
${workflowExtra}`;
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

function paymentActionTypes(type: PendingAction["type"]): boolean {
  return ["record_payment", "process_refund", "sale", "booking_service", "checkin"].includes(type);
}

export async function runHamsterChat(params: {
  session: SessionPayload;
  staffId: string;
  hotelId: string;
  hotelName: string | null;
  conversationId?: string;
  message?: string;
  intent?: string;
  buttonId?: string;
  reset?: boolean;
}): Promise<HamsterChatResponse> {
  const { session, staffId, hotelId, hotelName } = params;
  const seatId = session.seatId!;

  let conversationId = params.conversationId;
  let isNew = false;

  if (params.reset && conversationId) {
    await prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { slots: emptyHamsterWorkflow() as unknown as Prisma.InputJsonValue, pendingAction: Prisma.DbNull },
    });
  }

  if (conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, seatId, staffId },
    });
    if (!existing) conversationId = undefined;
  }

  if (!conversationId) {
    const conv = await prisma.assistantConversation.create({
      data: {
        seatId,
        staffId,
        hotelId,
        slots: emptyHamsterWorkflow() as unknown as Prisma.InputJsonValue,
      },
    });
    conversationId = conv.id;
    isNew = true;
  } else if (hotelId) {
    await prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { hotelId },
    });
  }

  const convRow = await prisma.assistantConversation.findUnique({ where: { id: conversationId } });
  let workflow = parseWorkflowState(convRow?.slots);

  const quickActions: HamsterQuickAction[] = HAMSTER_MAIN_ACTIONS;
  let choices: HamsterChoice[] | undefined;
  let fileRequest: HamsterFileRequest | undefined;
  let printLinks: HamsterChatResponse["printLinks"];
  let pendingAction: PendingAction | undefined;
  let reply = "";
  let briefing = false;

  // Intent / button → start workflow
  const intent = params.intent ?? params.buttonId;
  if (intent && !params.message?.trim()) {
    const started = startWorkflow(intent);
    workflow = started.workflow;
    reply = started.reply;
    await prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { slots: workflow as unknown as Prisma.InputJsonValue },
    });
    await prisma.assistantMessage.create({
      data: { conversationId, role: "user", content: `[кнопка: ${intent}]` },
    });
    await prisma.assistantMessage.create({
      data: { conversationId, role: "assistant", content: reply },
    });
    return {
      conversationId,
      reply,
      quickActions,
      workflowFlow: workflow.flow,
      briefing: false,
    };
  }

  // Morning briefing for new conversation
  if (isNew && hotelId) {
    const data = await getMorningBriefing(session, hotelId);
    reply = buildMorningBriefingText(data, hotelName);
    briefing = true;
    await prisma.assistantMessage.create({
      data: { conversationId, role: "assistant", content: reply, metadata: { briefing: true } },
    });
    return {
      conversationId,
      reply,
      quickActions,
      briefing,
      workflowFlow: "idle",
    };
  }

  const message = String(params.message ?? "").trim();
  if (!message) {
    return {
      conversationId,
      reply: "Хомячок, напиши что нужно — или жми кнопку 👇",
      quickActions,
      workflowFlow: workflow.flow,
    };
  }

  await prisma.assistantMessage.create({
    data: { conversationId, role: "user", content: message },
  });

  const history = await loadHistory(conversationId);
  const workflowExtra = workflowContextPrompt(workflow);
  const messages: ChatMessage[] = [
    { role: "system", content: buildHamsterSystemPrompt(hotelId, hotelName, workflowExtra) },
    ...history,
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await aitunnelChatCompletion({
      model: aitunnelHamsterModel(),
      messages,
      tools: HAMSTER_TOOLS,
    });

    if (completion.tool_calls?.length) {
      messages.push({ role: "assistant", content: completion.content ?? "" });

      for (const call of completion.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        if (
          hotelId &&
          !args.hotelId &&
          call.function.name !== "search_faq" &&
          call.function.name !== "find_guests" &&
          call.function.name !== "list_services"
        ) {
          args.hotelId = hotelId;
        }

        const toolResult = await runHamsterTool(session, call.function.name, args);
        if (toolResult.pendingAction) pendingAction = toolResult.pendingAction;
        if (toolResult.fileRequest) fileRequest = toolResult.fileRequest;
        if (toolResult.printLinks) printLinks = toolResult.printLinks;

        messages.push({
          role: "user",
          content: `[tool:${call.function.name}] ${JSON.stringify(toolResult.result)}`,
        });
      }

      if (pendingAction || fileRequest) break;
      continue;
    }

    reply = (completion.content ?? "").trim();
    if (!reply) reply = "Хм, не понял 😅 Скажи по-другому или жми кнопку!";
    break;
  }

  if (pendingAction) {
    reply = "Хомячок, проверь карточку и нажми «Да, делай!» если всё верно 🐹";
  }

  if (fileRequest && !pendingAction) {
    reply =
      reply ||
      "Хомячок, пришли фото паспорта прямо сюда — перетащи файл или нажми скрепку 📷";
  }

  await prisma.assistantMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: reply,
      metadata: pendingAction
        ? ({ pendingAction, fileRequest, printLinks } as unknown as Prisma.InputJsonValue)
        : fileRequest || printLinks
          ? ({ fileRequest, printLinks } as unknown as Prisma.InputJsonValue)
          : undefined,
    },
  });

  await prisma.assistantConversation.update({
    where: { id: conversationId },
    data: {
      pendingAction: pendingAction
        ? (pendingAction as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      slots: workflow as unknown as Prisma.InputJsonValue,
    },
  });

  const response: HamsterChatResponse = {
    conversationId,
    reply,
    quickActions,
    choices,
    fileRequest,
    printLinks,
    workflowFlow: workflow.flow,
  };

  if (pendingAction) {
    const paymentMethods = await ensurePaymentMethods(seatId);
    const needsPaymentMethod = paymentActionTypes(pendingAction.type);
    response.confirmation = {
      pendingAction,
      needsPaymentMethod,
      paymentMethods: needsPaymentMethod
        ? paymentMethods.filter((m) => m.active).map((m) => ({ code: m.code, label: m.label }))
        : undefined,
    };

    if (pendingAction.payload.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: String(pendingAction.payload.bookingId) },
        include: { room: true },
      });
      if (booking) {
        response.confirmation.bookingLink = {
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
        };
      }
    }
  }

  return response;
}

/** После загрузки паспорта — продолжить диалог с результатом скана */
export async function runHamsterAfterScan(params: {
  session: SessionPayload;
  staffId: string;
  hotelId: string;
  hotelName: string | null;
  conversationId: string;
  guestId: string;
  bookingId?: string;
  extract: Record<string, unknown>;
  filledFields: string[];
}): Promise<HamsterChatResponse> {
  const scanSummary =
    `Паспорт распознан. Заполнено полей: ${params.filledFields.length}. ` +
    `Данные: ${JSON.stringify(params.extract)}. ` +
    `guestId=${params.guestId}` +
    (params.bookingId ? `, bookingId=${params.bookingId}` : "") +
    `. Сформируй propose_checkin с form из данных или уточни у хомячка.`;

  return runHamsterChat({
    session: params.session,
    staffId: params.staffId,
    hotelId: params.hotelId,
    hotelName: params.hotelName,
    conversationId: params.conversationId,
    message: `[скан паспорта] ${scanSummary}`,
  });
}

export { buildPrintFormUrls } from "@/lib/assistant/queries.server";