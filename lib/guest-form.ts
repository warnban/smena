import type { Guest, MigRegStatus } from "@/lib/types";
import {
  getDocTypeConfig,
  normalizeDocType,
  PRIMARY_DOC_LABELS,
} from "@/lib/document-types";

export { PRIMARY_DOC_LABELS };

export const ARRIVAL_PURPOSE_LABELS: Record<string, string> = {
  tourism: "Туризм / отдых",
  business: "Деловая / служебная",
  work: "Трудовая деятельность",
  education: "Учёба / стажировка",
  private: "Частная",
  transit: "Транзит",
};

export type GuestFormData = {
  lastName: string;
  firstName: string;
  middleName: string;
  gender: "M" | "F";
  birthDate: string;
  birthPlace: string;
  phone: string;
  email: string;
  country: string;
  nationality: string;
  docType: string;
  docSeries: string;
  docNumber: string;
  docIssuedBy: string;
  docIssuedDate: string;
  docDivisionCode: string;
  docExpiry: string;
  registrationAddress: string;
  arrivalPurpose: string;
  entryDate: string;
  visa: Record<string, string> | null;
  migrationCard: Record<string, string> | null;
  hasVisa: boolean;
  preferences: string;
};

export function guestToForm(g: Guest): GuestFormData {
  return {
    lastName: g.lastName,
    firstName: g.firstName,
    middleName: g.middleName,
    gender: g.gender,
    birthDate: g.birthDate,
    birthPlace: g.birthPlace,
    phone: g.phone,
    email: g.email,
    country: g.country,
    nationality: g.nationality,
    docType: g.docType,
    docSeries: g.docSeries,
    docNumber: g.docNumber,
    docIssuedBy: g.docIssuedBy,
    docIssuedDate: g.docIssuedDate,
    docDivisionCode: g.docDivisionCode,
    docExpiry: g.docExpiry,
    registrationAddress: g.registrationAddress,
    arrivalPurpose: g.arrivalPurpose,
    entryDate: g.entryDate,
    visa: g.visa,
    migrationCard: g.migrationCard,
    hasVisa: Boolean(g.visa),
    preferences: g.preferences,
  };
}

export function formDisplayName(f: GuestFormData): string {
  return [f.lastName, f.firstName, f.middleName].filter(Boolean).join(" ").trim();
}

/** +1 рабочий день от даты заезда */
export function migRegDeadlineFrom(checkIn: Date): string {
  const d = new Date(checkIn);
  let added = 0;
  while (added < 1) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

import { phoneValidationMessage } from "@/lib/validation/phone";
import { ruDateValidationMessage } from "@/lib/validation/date";

/** Только проверка формата телефона и дат — обязательность полей отключена */
export function validateCheckInForm(_guest: { isForeigner: boolean }, form: GuestFormData): string[] {
  const errors: string[] = [];

  const phoneErr = phoneValidationMessage(form.phone);
  if (phoneErr) errors.push(phoneErr);

  const docCfg = getDocTypeConfig(normalizeDocType(form.docType));

  const dateChecks: Array<{ value: string; label: string; kind: "birth" | "past" | "future" | "any" }> = [
    { value: form.birthDate, label: "Дата рождения", kind: "birth" },
  ];

  if (docCfg.fields.includes("issuedDate")) {
    dateChecks.push({ value: form.docIssuedDate, label: "Дата выдачи документа", kind: "past" });
  }
  if (docCfg.fields.includes("expiry")) {
    dateChecks.push({ value: form.docExpiry, label: "Срок действия документа", kind: "future" });
  }
  if (_guest.isForeigner && docCfg.entryInfo) {
    dateChecks.push({ value: form.entryDate, label: "Дата въезда в РФ", kind: "past" });
  }
  if (_guest.isForeigner && docCfg.migrationCard) {
    dateChecks.push({
      value: form.migrationCard?.entryDate ?? "",
      label: "Дата въезда (миграц. карта)",
      kind: "past",
    });
  }
  if (_guest.isForeigner && docCfg.visaOption && form.hasVisa) {
    dateChecks.push({ value: form.visa?.expiry ?? "", label: "Срок действия визы", kind: "future" });
  }

  for (const { value, label, kind } of dateChecks) {
    const msg = ruDateValidationMessage(value, kind);
    if (msg) errors.push(`${label}: ${msg}`);
  }

  return errors;
}

export function guestUpdatePayload(form: GuestFormData, isForeigner: boolean) {
  const name = formDisplayName(form);
  const visa = isForeigner && form.hasVisa ? form.visa : null;
  const migrationCard = isForeigner ? form.migrationCard : null;

  return {
    name,
    lastName: form.lastName.trim(),
    firstName: form.firstName.trim(),
    middleName: form.middleName.trim(),
    gender: form.gender,
    birthDate: form.birthDate.trim(),
    birthPlace: form.birthPlace.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    country: form.country.trim(),
    nationality: form.nationality.trim() || (isForeigner ? "" : "RU"),
    docType: normalizeDocType(form.docType),
    docSeries: form.docSeries.trim(),
    docNumber: form.docNumber.trim(),
    docIssuedBy: form.docIssuedBy.trim(),
    docIssuedDate: form.docIssuedDate.trim(),
    docDivisionCode: form.docDivisionCode.trim(),
    docExpiry: form.docExpiry.trim(),
    registrationAddress: form.registrationAddress.trim(),
    arrivalPurpose: isForeigner ? form.arrivalPurpose : "",
    entryDate: isForeigner ? form.entryDate.trim() : "",
    visa: visa ?? undefined,
    migrationCard: migrationCard ?? undefined,
    preferences: form.preferences.trim(),
  };
}

export function isMigRegOverdue(deadline: string): boolean {
  if (!deadline) return false;
  const [d, m, y] = deadline.split(".").map(Number);
  if (!d || !m || !y) return false;
  const dl = new Date(y, m - 1, d, 23, 59, 59);
  return dl < new Date();
}

export function effectiveMigStatus(status: MigRegStatus, deadline: string): MigRegStatus {
  if (status === "pending" && isMigRegOverdue(deadline)) return "overdue";
  return status;
}
