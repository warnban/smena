import type { HamsterQuickAction, HamsterWorkflowFlow, HamsterWorkflowState } from "@/lib/assistant/types";

export const HAMSTER_STORAGE_KEY = "hamsterMode";

export const HAMSTER_MAIN_ACTIONS: HamsterQuickAction[] = [
  { id: "booking", label: "📅 Новая бронь", intent: "create_booking" },
  { id: "checkin", label: "🏠 Заселить", intent: "checkin" },
  { id: "payment", label: "💰 Оплата", intent: "record_payment" },
  { id: "extend", label: "⏰ Продлить", intent: "extend_stay" },
  { id: "relocate", label: "🔄 Переселить", intent: "relocate" },
  { id: "checkout", label: "🚪 Выселить", intent: "checkout" },
  { id: "sale", label: "🛒 Продажа", intent: "sale" },
  { id: "refund", label: "↩️ Возврат", intent: "process_refund" },
  { id: "encashment", label: "💼 Инкассация", intent: "encashment" },
  { id: "cancel", label: "❌ Отмена брони", intent: "cancel_booking" },
  { id: "service", label: "☕ Услуга к брони", intent: "booking_service" },
  { id: "mig_reg", label: "🛂 Мигучёт", intent: "mig_reg" },
  { id: "housekeeping", label: "✨ Уборка", intent: "housekeeping" },
  { id: "print", label: "🖨️ Бланки", intent: "print_forms" },
  { id: "help", label: "❓ Справка", intent: "faq" },
];

const INTENT_TO_FLOW: Record<string, HamsterWorkflowFlow> = {
  create_booking: "booking",
  checkin: "checkin",
  record_payment: "payment",
  extend_stay: "extend",
  process_refund: "refund",
  checkout: "checkout",
  relocate: "relocate",
  sale: "sale",
  encashment: "encashment",
  cancel_booking: "cancel",
  booking_service: "service",
  mig_reg: "mig_reg",
  housekeeping: "housekeeping",
  print_forms: "print",
  faq: "idle",
};

const FLOW_START_MESSAGES: Record<HamsterWorkflowFlow, string> = {
  idle: "",
  booking: "Окей, хомячок! Давай сделаем новую запись на номер 🏨\nКак зовут гостя? И на какие даты?",
  checkin:
    "Супер, заселяем! 🎉\nУ гостя уже есть запись (бронь)? Напиши имя или номер комнаты — или скажи «новый гость».",
  payment: "Хомячок, кому принимаем оплату? Напиши имя гостя или номер комнаты 💰",
  extend: "Продлим проживание! ⏰ Кого продлеваем? Имя или номер комнаты.",
  refund: "Оформим возврат ↩️ Кого ищем? Имя гостя или номер.",
  checkout: "Выписываем гостя 🚪 Кого выселяем? Имя или номер комнаты.",
  relocate: "Переселяем! 🔄 Кого и куда? Сначала — кого переселяем (имя или номер).",
  sale: "Продажа услуги 🛒 Что продаём? Можешь написать «завтрак Петрову» или просто «завтрак».",
  encashment: "Инкассация 💼 Сколько денег сдаём в сейф? Напиши сумму.",
  cancel: "Отмена записи ❌ Какую бронь отменяем? Имя или номер.",
  service: "Услуга к проживанию ☕ Кому добавляем? Имя или номер комнаты.",
  mig_reg: "Мигучёт 🛂 Какого иностранца отмечаем? Имя гостя.",
  housekeeping: "Уборка ✨ Какой номер убрали? Напиши номер или «список задач».",
  print: "Бланки для печати 🖨️ Кого печатаем? Имя гостя или номер комнаты.",
};

export function emptyHamsterWorkflow(): HamsterWorkflowState {
  return { mode: "hamster", flow: "idle", step: "start", data: {} };
}

export function parseWorkflowState(raw: unknown): HamsterWorkflowState {
  if (!raw || typeof raw !== "object") return emptyHamsterWorkflow();
  const o = raw as Record<string, unknown>;
  if (o.mode !== "hamster") return emptyHamsterWorkflow();
  const flow = (typeof o.flow === "string" ? o.flow : "idle") as HamsterWorkflowFlow;
  return {
    mode: "hamster",
    flow,
    step: typeof o.step === "string" ? o.step : "start",
    data: typeof o.data === "object" && o.data && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : {},
  };
}

export function startWorkflow(intent: string): { workflow: HamsterWorkflowState; reply: string } {
  const flow = INTENT_TO_FLOW[intent] ?? "idle";
  if (flow === "idle") {
    return {
      workflow: emptyHamsterWorkflow(),
      reply:
        intent === "faq"
          ? "Спроси меня про правила отеля — я поищу в нашей справке! 📚"
          : "Хомячок, выбери кнопку ниже или просто напиши, что нужно сделать 😊",
    };
  }
  return {
    workflow: { mode: "hamster", flow, step: "collect", data: {} },
    reply: FLOW_START_MESSAGES[flow],
  };
}

export function workflowContextPrompt(workflow: HamsterWorkflowState): string {
  if (workflow.flow === "idle") return "";
  const dataJson = JSON.stringify(workflow.data);
  return `\n\n[Текущий сценарий: ${workflow.flow}, шаг: ${workflow.step}, данные: ${dataJson}. Веди хомячка по этому сценарию до propose_* и подтверждения.]`;
}
