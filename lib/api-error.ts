import { Prisma } from "@prisma/client";

export function apiErrorMessage(e: unknown, fallback = "Внутренняя ошибка сервера"): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2003") return "Связанная запись не найдена (проверьте канал OTA)";
    if (e.code === "P2025") return "Запись не найдена";
    if (e.code === "P2002") return "Конфликт данных";
    if (e.code === "P2022") {
      return "Схема БД не совпадает с приложением. Выполните npx prisma db push и перезапустите сервер";
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    if (e.message.includes("channelId")) {
      return "Схема БД устарела: перезапустите сервер после npx prisma generate";
    }
    if (e.message.includes("cancelledAt") || e.message.includes("cancelledByUserId")) {
      return "Схема БД не обновлена: npx prisma db push && npx prisma generate, затем перезапустите сервер";
    }
    return "Ошибка валидации данных";
  }

  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
