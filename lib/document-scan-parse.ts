import {
  getDefaultDocType,
  isDocTypeAllowed,
  normalizeDocType,
  type DocTypeId,
} from "@/lib/document-types";
import type { DocumentScanExtract } from "@/lib/document-scan-types";
import { isValidDocTypeId } from "@/lib/document-scan-prompt";

const ARRIVAL_PURPOSES = new Set([
  "tourism",
  "business",
  "work",
  "education",
  "private",
  "transit",
]);

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function gender(v: unknown): "M" | "F" | "" {
  const s = str(v).toUpperCase();
  if (s === "M" || s === "М" || s === "MALE") return "M";
  if (s === "F" || s === "Ж" || s === "FEMALE") return "F";
  return "";
}

function record(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = str(val);
  }
  return Object.values(out).some(Boolean) ? out : null;
}

function normalizeDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return s;
}

function normalizeNationality(v: unknown): string {
  const s = str(v).toUpperCase();
  if (!s) return "";
  if (s === "RUS" || s === "RUSSIA" || s === "РФ" || s === "РОССИЯ") return "RU";
  return s.length === 2 ? s : s.slice(0, 2);
}

/** Вытащить JSON из ответа модели (в т.ч. из ```json блока) */
export function extractJsonFromLlmText(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Модель не вернула JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseDocumentScanJson(raw: unknown): DocumentScanExtract {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const nationality = normalizeNationality(o.nationality);
  const isForeigner = bool(o.isForeigner) || (nationality !== "" && nationality !== "RU");

  let docType: DocTypeId = isValidDocTypeId(str(o.docType))
    ? (str(o.docType) as DocTypeId)
    : getDefaultDocType(isForeigner);

  if (!isDocTypeAllowed(docType, isForeigner)) {
    docType = getDefaultDocType(isForeigner);
  }

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.map((w) => str(w)).filter(Boolean)
    : [];

  const confidenceRaw = Number(o.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5;

  const arrivalPurpose = ARRIVAL_PURPOSES.has(str(o.arrivalPurpose))
    ? str(o.arrivalPurpose)
    : "";

  const hasVisa = bool(o.hasVisa);
  const visa = hasVisa ? record(o.visa) : null;
  const migrationCard = record(o.migrationCard);

  return {
    docType: normalizeDocType(docType),
    nationality: nationality || (isForeigner ? "" : "RU"),
    country: str(o.country) || (isForeigner ? "" : "Россия"),
    isForeigner,
    lastName: str(o.lastName),
    firstName: str(o.firstName),
    middleName: str(o.middleName),
    gender: gender(o.gender),
    birthDate: normalizeDate(o.birthDate),
    birthPlace: str(o.birthPlace),
    docSeries: str(o.docSeries),
    docNumber: str(o.docNumber),
    docIssuedBy: str(o.docIssuedBy),
    docIssuedDate: normalizeDate(o.docIssuedDate),
    docDivisionCode: str(o.docDivisionCode),
    docExpiry: normalizeDate(o.docExpiry),
    registrationAddress: str(o.registrationAddress),
    entryDate: normalizeDate(o.entryDate),
    arrivalPurpose,
    hasVisa,
    visa,
    migrationCard,
    confidence,
    warnings,
  };
}

export function listFilledExtractFields(extract: DocumentScanExtract): string[] {
  const labels: Record<string, string> = {
    lastName: "Фамилия",
    firstName: "Имя",
    middleName: "Отчество",
    gender: "Пол",
    birthDate: "Дата рождения",
    birthPlace: "Место рождения",
    country: "Страна",
    nationality: "Гражданство",
    docType: "Вид документа",
    docSeries: "Серия",
    docNumber: "Номер",
    docIssuedBy: "Кем выдан",
    docIssuedDate: "Дата выдачи",
    docDivisionCode: "Код подразделения",
    docExpiry: "Срок действия",
    registrationAddress: "Адрес",
    entryDate: "Дата въезда",
    arrivalPurpose: "Цель поездки",
  };

  const filled: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const val = extract[key as keyof DocumentScanExtract];
    if (typeof val === "string" && val.trim()) filled.push(label);
  }
  if (extract.hasVisa && extract.visa) filled.push("Виза");
  if (extract.migrationCard) filled.push("Миграционная карта");
  return filled;
}
