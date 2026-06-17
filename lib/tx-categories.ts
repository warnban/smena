export const TX_CAT_LABELS: Record<string, string> = {
  accommodation: "Проживание",
  breakfast: "Завтрак",
  laundry: "Стирка",
  slippers: "Тапочки",
  minibar: "Мини-бар",
  parking: "Парковка",
  transfer_srv: "Трансфер",
  sauna: "Сауна",
  extra: "Прочее",
  encashment: "Инкассация",
  salary: "Зарплата",
  bonus: "Премия",
};

/** Подпись категории в отчётах (проживание → «Гости»). */
export function txCategoryLabel(category: string): string {
  if (category === "accommodation") return "Гости";
  return TX_CAT_LABELS[category] ?? category;
}
