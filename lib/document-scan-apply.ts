import {
  sanitizeDocFieldsOnTypeChange,
  type DocTypeId,
} from "@/lib/document-types";
import type { GuestFormData } from "@/lib/guest-form";
import type { DocumentScanExtract } from "@/lib/document-scan-types";

function has(v: string): boolean {
  return v.trim().length > 0;
}

/** Данные со скана заменяют поля формы (в т.ч. ФИО из брони). Телефон и email не трогаем. */
export function applyDocumentScanToForm(
  form: GuestFormData,
  extract: DocumentScanExtract
): GuestFormData {
  let next: GuestFormData = {
    ...form,
    docType: extract.docType,
    country: has(extract.country) ? extract.country.trim() : form.country,
    nationality: has(extract.nationality) ? extract.nationality.trim() : form.nationality,
    lastName: has(extract.lastName) ? extract.lastName.trim() : form.lastName,
    firstName: has(extract.firstName) ? extract.firstName.trim() : form.firstName,
    middleName: has(extract.middleName) ? extract.middleName.trim() : form.middleName,
    gender:
      extract.gender === "M" || extract.gender === "F" ? extract.gender : form.gender,
    birthDate: has(extract.birthDate) ? extract.birthDate.trim() : form.birthDate,
    birthPlace: has(extract.birthPlace) ? extract.birthPlace.trim() : form.birthPlace,
    docSeries: has(extract.docSeries) ? extract.docSeries.trim() : form.docSeries,
    docNumber: has(extract.docNumber) ? extract.docNumber.trim() : form.docNumber,
    docIssuedBy: has(extract.docIssuedBy) ? extract.docIssuedBy.trim() : form.docIssuedBy,
    docIssuedDate: has(extract.docIssuedDate) ? extract.docIssuedDate.trim() : form.docIssuedDate,
    docDivisionCode: has(extract.docDivisionCode)
      ? extract.docDivisionCode.trim()
      : form.docDivisionCode,
    docExpiry: has(extract.docExpiry) ? extract.docExpiry.trim() : form.docExpiry,
    registrationAddress: has(extract.registrationAddress)
      ? extract.registrationAddress.trim()
      : form.registrationAddress,
    entryDate: has(extract.entryDate) ? extract.entryDate.trim() : form.entryDate,
    arrivalPurpose: has(extract.arrivalPurpose)
      ? extract.arrivalPurpose.trim()
      : form.arrivalPurpose,
    hasVisa: extract.hasVisa,
    visa: extract.hasVisa ? extract.visa ?? {} : null,
    migrationCard: extract.migrationCard ?? null,
  };

  next = sanitizeDocFieldsOnTypeChange(
    next,
    extract.docType as DocTypeId,
    extract.isForeigner
  );

  // После sanitize — снова подставить распознанное (sanitize мог очистить лишнее по типу)
  const patch = (key: keyof GuestFormData, val: string) => {
    if (has(val)) (next as Record<string, unknown>)[key] = val.trim();
  };
  patch("lastName", extract.lastName);
  patch("firstName", extract.firstName);
  patch("middleName", extract.middleName);
  patch("birthDate", extract.birthDate);
  patch("birthPlace", extract.birthPlace);
  patch("country", extract.country);
  patch("nationality", extract.nationality);
  patch("docSeries", extract.docSeries);
  patch("docNumber", extract.docNumber);
  patch("docIssuedBy", extract.docIssuedBy);
  patch("docIssuedDate", extract.docIssuedDate);
  patch("docDivisionCode", extract.docDivisionCode);
  patch("docExpiry", extract.docExpiry);
  patch("registrationAddress", extract.registrationAddress);
  patch("entryDate", extract.entryDate);
  patch("arrivalPurpose", extract.arrivalPurpose);

  if (extract.hasVisa) {
    next.hasVisa = true;
    next.visa = extract.visa ?? next.visa ?? {};
  }
  if (extract.migrationCard) {
    next.migrationCard = extract.migrationCard;
  }

  return next;
}
