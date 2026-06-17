export type RoomCategoryDef = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export const DEFAULT_ROOM_CATEGORIES: Omit<RoomCategoryDef, "id">[] = [
  { code: "Single", label: "Одноместный", sortOrder: 0, active: true },
  { code: "Double", label: "Двухместный", sortOrder: 1, active: true },
  { code: "Family", label: "Семейный", sortOrder: 2, active: true },
  { code: "Presidential", label: "Президентский", sortOrder: 3, active: true },
];

export function categoryLabel(categories: RoomCategoryDef[], code: string): string {
  const hit = categories.find((c) => c.active && c.code === code);
  if (hit) return hit.label;
  const legacy: Record<string, string> = {
    Single: "Одноместный",
    Double: "Двухместный",
    Family: "Семейный",
    Presidential: "Президентский",
  };
  return legacy[code] ?? code;
}

export function activeCategoryCodes(categories: RoomCategoryDef[]): string[] {
  return categories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.code);
}

export function slugifyCategoryCode(label: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const raw = label
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return raw || "category";
}
