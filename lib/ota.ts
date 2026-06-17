import type { BookingStatus } from "@/lib/types";

export const OTA_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  booking: { label: "Бронирование", bg: "#EFF6FF", text: "#2563EB" },
  staying: { label: "Живёт", bg: "#FFFBEB", text: "#D97706" },
  departed: { label: "Выехал", bg: "#F0FDF4", text: "#059669" },
};

export function otaDisplayStatus(status: BookingStatus): keyof typeof OTA_STATUS_LABELS {
  if (status === "checkedin") return "staying";
  if (status === "checkedout") return "departed";
  return "booking";
}

export function isOtaBooking(source: string, channelId?: string | null): boolean {
  return Boolean(channelId) || (source !== "direct" && source !== "");
}

export function slugifyChannelCode(name: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const raw = name
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return raw || "channel";
}
