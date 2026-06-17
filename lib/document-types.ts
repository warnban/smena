/**
 * Типы документов и поля для Формы №5 / миграционного учёта.
 *
 * Граждане РФ — ПП РФ №713 (ред. 2025–2026):
 * паспорт РФ, паспорт СССР, загранпаспорт, свидетельство о рождении (<14),
 * временное удостоверение личности, водительское удостоверение (с 01.01.2026).
 *
 * Иностранцы и лица без гражданства — ПП РФ №1912 (2025), ФЗ №109-ФЗ:
 * паспорт ИГ, ID-карта, ВНЖ, РВП, удостоверение беженца, временное убежище,
 * временное удостоверение лица без гражданства.
 */

export type DocFieldKey = "series" | "number" | "issuedBy" | "issuedDate" | "divisionCode" | "expiry";

export type DocCitizenGroup = "rf" | "foreign";

export type DocTypeId =
  | "rf_passport"
  | "rf_intl_passport"
  | "rf_intl_passport_bio"
  | "ussr_passport"
  | "rf_birth_cert"
  | "rf_temp_id"
  | "rf_driver_license"
  | "foreign_passport"
  | "foreign_id_card"
  | "residence_permit"
  | "temp_residence"
  | "refugee_cert"
  | "asylum_cert"
  | "stateless_temp_id"
  | "stateless_doc"
  | "other";

export type DocTypeConfig = {
  id: DocTypeId;
  label: string;
  group: DocCitizenGroup;
  fields: DocFieldKey[];
  fieldLabels?: Partial<Record<DocFieldKey, string>>;
  placeholders?: Partial<Record<DocFieldKey, string>>;
  /** Показывать блок миграционной карты */
  migrationCard: boolean;
  /** Показывать чекбокс «есть виза» */
  visaOption: boolean;
  /** Показывать дату въезда в РФ и цель поездки */
  entryInfo: boolean;
  registrationSectionTitle: string;
  hint?: string;
};

const FIELD_LABELS: Record<DocFieldKey, string> = {
  series: "Серия",
  number: "Номер",
  issuedBy: "Кем выдан",
  issuedDate: "Дата выдачи",
  divisionCode: "Код подразделения",
  expiry: "Действителен до",
};

export const DOC_TYPES: DocTypeConfig[] = [
  {
    id: "rf_passport",
    label: "Паспорт гражданина РФ",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate", "divisionCode"],
    placeholders: { series: "45 21", number: "356789", divisionCode: "770-001" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации по месту жительства",
  },
  {
    id: "rf_intl_passport",
    label: "Загранпаспорт гражданина РФ",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    placeholders: { series: "51", number: "1234567" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "В загранпаспорте нет штампа регистрации — при отсутствии сведений укажите «Отсутствует».",
  },
  {
    id: "rf_intl_passport_bio",
    label: "Загранпаспорт гражданина РФ (биометрический)",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    placeholders: { series: "53", number: "1234567" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "Биометрический загранпаспорт. Срок действия — 10 лет.",
  },
  {
    id: "ussr_passport",
    label: "Паспорт гражданина СССР",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate"],
    placeholders: { series: "IV-АБ", number: "123456" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "Допустим, если паспорт выдан/продлён до 01.07.2004 и гостю исполнилось 45 лет.",
  },
  {
    id: "rf_birth_cert",
    label: "Свидетельство о рождении",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate"],
    fieldLabels: { series: "Серия", issuedBy: "Кем выдано (ЗАГС)" },
    placeholders: { series: "I-БК", number: "123456" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "Для граждан РФ, не достигших 14 лет.",
  },
  {
    id: "rf_temp_id",
    label: "Временное удостоверение личности гражданина РФ",
    group: "rf",
    fields: ["number", "issuedBy", "issuedDate", "expiry"],
    placeholders: { number: "1234567890" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "Регистрация только на бумажном носителе, не через электронный документооборот.",
  },
  {
    id: "rf_driver_license",
    label: "Водительское удостоверение",
    group: "rf",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    fieldLabels: { issuedBy: "Кем выдано (ГИБДД)" },
    placeholders: { series: "77 01", number: "123456" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации",
    hint: "С 01.01.2026 — при отсутствии паспорта, только в классифицированных гостиницах.",
  },
  {
    id: "foreign_passport",
    label: "Паспорт иностранного гражданина",
    group: "foreign",
    fields: ["number", "issuedBy", "issuedDate", "expiry"],
    fieldLabels: { number: "Номер паспорта", issuedBy: "Орган, выдавший паспорт" },
    migrationCard: true,
    visaOption: true,
    entryInfo: true,
    registrationSectionTitle: "Адрес постоянного проживания за рубежом",
  },
  {
    id: "foreign_id_card",
    label: "ID-карта (национальное удостоверение личности)",
    group: "foreign",
    fields: ["number", "issuedBy", "issuedDate", "expiry"],
    fieldLabels: { number: "Номер ID-карты" },
    migrationCard: true,
    visaOption: true,
    entryInfo: true,
    registrationSectionTitle: "Адрес постоянного проживания",
  },
  {
    id: "residence_permit",
    label: "Вид на жительство (ВНЖ)",
    group: "foreign",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    fieldLabels: { issuedBy: "Кем выдан (МВД России)" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации в РФ",
    hint: "Документ лица, постоянно проживающего в РФ. Миграционная карта не требуется.",
  },
  {
    id: "temp_residence",
    label: "Разрешение на временное проживание (РВП)",
    group: "foreign",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    fieldLabels: { issuedBy: "Кем выдано (МВД России)" },
    migrationCard: false,
    visaOption: false,
    entryInfo: false,
    registrationSectionTitle: "Адрес регистрации в РФ",
    hint: "Временно проживающий в РФ. Миграционная карта не требуется.",
  },
  {
    id: "refugee_cert",
    label: "Удостоверение беженца",
    group: "foreign",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    migrationCard: false,
    visaOption: false,
    entryInfo: true,
    registrationSectionTitle: "Адрес регистрации / пребывания",
  },
  {
    id: "asylum_cert",
    label: "Свидетельство о предоставлении временного убежища",
    group: "foreign",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    migrationCard: false,
    visaOption: false,
    entryInfo: true,
    registrationSectionTitle: "Адрес пребывания",
  },
  {
    id: "stateless_temp_id",
    label: "Временное удостоверение личности лица без гражданства",
    group: "foreign",
    fields: ["number", "issuedBy", "issuedDate", "expiry"],
    migrationCard: true,
    visaOption: true,
    entryInfo: true,
    registrationSectionTitle: "Адрес пребывания",
  },
  {
    id: "stateless_doc",
    label: "Документ лица без гражданства (иностранного образца)",
    group: "foreign",
    fields: ["number", "issuedBy", "issuedDate", "expiry"],
    migrationCard: true,
    visaOption: true,
    entryInfo: true,
    registrationSectionTitle: "Адрес постоянного проживания",
  },
  {
    id: "other",
    label: "Иной документ, удостоверяющий личность",
    group: "foreign",
    fields: ["series", "number", "issuedBy", "issuedDate", "expiry"],
    migrationCard: true,
    visaOption: true,
    entryInfo: true,
    registrationSectionTitle: "Адрес постоянного проживания / регистрации",
    hint: "Укажите вид документа в примечаниях, если он не входит в стандартный перечень.",
  },
];

const DOC_BY_ID = Object.fromEntries(DOC_TYPES.map((d) => [d.id, d])) as Record<DocTypeId, DocTypeConfig>;

/** Обратная совместимость со старыми значениями в БД */
const LEGACY_DOC_MAP: Record<string, DocTypeId> = {
  stateless: "stateless_doc",
};

export function normalizeDocType(docType: string): DocTypeId {
  const mapped = LEGACY_DOC_MAP[docType] ?? docType;
  if (mapped in DOC_BY_ID) return mapped as DocTypeId;
  return "other";
}

export function getDocTypesForGuest(isForeigner: boolean): DocTypeConfig[] {
  const group: DocCitizenGroup = isForeigner ? "foreign" : "rf";
  return DOC_TYPES.filter((d) => d.group === group);
}

export function getDefaultDocType(isForeigner: boolean): DocTypeId {
  return isForeigner ? "foreign_passport" : "rf_passport";
}

export function getDocTypeConfig(docType: string): DocTypeConfig {
  return DOC_BY_ID[normalizeDocType(docType)] ?? DOC_BY_ID.other;
}

export function isDocTypeAllowed(docType: string, isForeigner: boolean): boolean {
  const cfg = getDocTypeConfig(docType);
  const group: DocCitizenGroup = isForeigner ? "foreign" : "rf";
  return cfg.group === group;
}

export function getDocFieldLabel(config: DocTypeConfig, field: DocFieldKey): string {
  return config.fieldLabels?.[field] ?? FIELD_LABELS[field];
}

/** Словарь для отображения в списках */
export const PRIMARY_DOC_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.id, d.label])
);
PRIMARY_DOC_LABELS.stateless = DOC_BY_ID.stateless_doc.label;

export type DocFormSlice = {
  docType: string;
  docSeries: string;
  docNumber: string;
  docIssuedBy: string;
  docIssuedDate: string;
  docDivisionCode: string;
  docExpiry: string;
  arrivalPurpose: string;
  entryDate: string;
  hasVisa: boolean;
  visa: Record<string, string> | null;
  migrationCard: Record<string, string> | null;
};

/** Очистить поля, не относящиеся к выбранному типу документа */
export function sanitizeDocFieldsOnTypeChange<T extends DocFormSlice>(
  form: T,
  newDocType: DocTypeId,
  isForeigner: boolean
): T {
  const cfg = getDocTypeConfig(newDocType);
  const allowed = new Set(cfg.fields);

  const next: T = {
    ...form,
    docType: newDocType,
    docSeries: allowed.has("series") ? form.docSeries : "",
    docNumber: allowed.has("number") ? form.docNumber : "",
    docIssuedBy: allowed.has("issuedBy") ? form.docIssuedBy : "",
    docIssuedDate: allowed.has("issuedDate") ? form.docIssuedDate : "",
    docDivisionCode: allowed.has("divisionCode") ? form.docDivisionCode : "",
    docExpiry: allowed.has("expiry") ? form.docExpiry : "",
  };

  if (!isForeigner || !cfg.entryInfo) {
    next.entryDate = "";
    next.arrivalPurpose = "";
  }

  if (!isForeigner || !cfg.migrationCard) {
    next.migrationCard = null;
  } else if (!next.migrationCard) {
    next.migrationCard = {};
  }

  if (!isForeigner || !cfg.visaOption) {
    next.hasVisa = false;
    next.visa = null;
  } else if (next.hasVisa && !next.visa) {
    next.visa = {};
  }

  return next;
}

export function ensureValidDocType<T extends DocFormSlice>(form: T, isForeigner: boolean): T {
  const normalized = normalizeDocType(form.docType);
  const targetId = isDocTypeAllowed(normalized, isForeigner)
    ? normalized
    : getDefaultDocType(isForeigner);

  const cfg = getDocTypeConfig(targetId);
  const hasStaleData =
    (!cfg.fields.includes("series") && form.docSeries) ||
    (!cfg.fields.includes("divisionCode") && form.docDivisionCode) ||
    (!cfg.fields.includes("expiry") && form.docExpiry) ||
    (!cfg.migrationCard && form.migrationCard) ||
    (!cfg.visaOption && (form.hasVisa || form.visa)) ||
    (!cfg.entryInfo && (form.entryDate || form.arrivalPurpose));

  if (form.docType === targetId && !hasStaleData) return form;
  return sanitizeDocFieldsOnTypeChange(form, targetId, isForeigner);
}
