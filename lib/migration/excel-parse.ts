import * as XLSX from "xlsx";
import type {
  ExcelDupRow,
  ExcelGuestRow,
  ExcelOtherRow,
  ExcelWorkbookData,
} from "@/lib/migration/excel-types";

const GUEST_SHEET = / гости$/i;
const OTHER_SHEET = / проче/i;
const DUP_SHEET = / дубли$/i;

export function hotelNameFromSheet(sheetName: string): string {
  return sheetName
    .replace(/\s+(гости|прочее|проче|дубли)$/i, "")
    .trim();
}

export function parseProfileIds(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
}

export function parseRuDate(s: unknown): Date | null {
  const m = String(s ?? "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`);
}

export function parseRuDateKey(s: unknown): string | null {
  const d = parseRuDate(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function parseStayPeriod(text: string): {
  checkIn: Date;
  checkOut: Date;
  isLiving: boolean;
} {
  const raw = text.trim();
  const isLiving = /н\.в\./i.test(raw);
  const dates: Date[] = [];
  const dm = raw.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g);
  for (const m of Array.from(dm)) {
    dates.push(new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`));
  }
  const fallback = new Date("2026-02-01T12:00:00.000Z");
  if (!dates.length) {
    return {
      checkIn: fallback,
      checkOut: new Date(fallback.getTime() + 86_400_000),
      isLiving,
    };
  }
  const checkIn = new Date(Math.min(...dates.map((d) => d.getTime())));
  let checkOut: Date;
  if (isLiving) {
    checkOut = new Date();
    checkOut.setUTCHours(12, 0, 0, 0);
    checkOut.setUTCDate(checkOut.getUTCDate() + 1);
  } else {
    checkOut = new Date(Math.max(...dates.map((d) => d.getTime())));
    if (checkOut.getTime() <= checkIn.getTime()) {
      checkOut = new Date(checkIn.getTime() + 86_400_000);
    }
  }
  return { checkIn, checkOut, isLiving };
}

export function canonicalProfileId(ids: string[], aliasToCanonical: Map<string, string>): string {
  const first = ids[0];
  if (!first) return "";
  return aliasToCanonical.get(first) ?? first;
}

export function buildProfileAliasMap(dupRows: ExcelDupRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of dupRows) {
    const ids = row.profileIds;
    if (!ids.length) continue;
    const canonical = ids[0]!;
    for (const id of ids) map.set(id, canonical);
  }
  return map;
}

export function parseExcelBuffer(buffer: Buffer): ExcelWorkbookData {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const guestRows: ExcelGuestRow[] = [];
  const otherRows: ExcelOtherRow[] = [];
  const dupRows: ExcelDupRow[] = [];
  const hotelSet = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const hotelName = hotelNameFromSheet(sheetName);
    if (sheetName === "Сводка") continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
      defval: "",
    });

    if (GUEST_SHEET.test(sheetName)) {
      hotelSet.add(hotelName);
      for (const r of rows) {
        guestRows.push({
          hotelName,
          group: String(r["Группа"] ?? ""),
          fullName: String(r["ФИО (итог)"] ?? "").trim(),
          profileIds: parseProfileIds(r["ID профилей"]),
          place: String(r["Койко/комната"] ?? "").trim(),
          stayPeriod: String(r["Период проживания"] ?? ""),
          payDate: String(r["Дата оплаты"] ?? ""),
          amount: Math.round(Number(r["Сумма"] ?? 0)),
          paymentMethod: String(r["Способ оплаты"] ?? "").trim(),
          payPeriod: String(r["Период оплаты"] ?? ""),
          comment: String(r["Комментарий"] ?? ""),
        });
      }
    } else if (OTHER_SHEET.test(sheetName)) {
      hotelSet.add(hotelName);
      for (const r of rows) {
        otherRows.push({
          hotelName,
          date: String(r["Дата"] ?? ""),
          type: String(r["Тип"] ?? ""),
          category: String(r["Категория"] ?? ""),
          amount: Math.round(Number(r["Сумма"] ?? 0)),
          paymentMethod: String(r["Способ"] ?? "").trim(),
          payer: String(r["Плательщик"] ?? ""),
          receiver: String(r["Получатель"] ?? ""),
          comment: String(r["Комментарий"] ?? ""),
        });
      }
    } else if (DUP_SHEET.test(sheetName)) {
      for (const r of rows) {
        dupRows.push({
          hotelName,
          group: String(r["Группа"] ?? ""),
          canonicalName: String(r["ФИО (канон)"] ?? ""),
          profileIds: parseProfileIds(r["ID профилей"]),
          reason: String(r["Причина склейки"] ?? ""),
        });
      }
    }
  }

  return {
    guestRows,
    otherRows,
    dupRows,
    hotelNames: Array.from(hotelSet),
  };
}

export function splitName(fullName: string): {
  name: string;
  lastName: string;
  firstName: string;
  middleName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const lastName = parts[0] ?? "";
  const firstName = parts[1] ?? "";
  const middleName = parts.slice(2).join(" ");
  return { name: fullName.trim(), lastName, firstName, middleName };
}

export function txDedupKey(parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join("|");
}
