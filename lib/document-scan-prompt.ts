import { DOC_TYPES, type DocTypeId } from "@/lib/document-types";

const DOC_TYPE_LIST = DOC_TYPES.map(
  (d) => `- ${d.id}: ${d.label} (${d.group === "rf" ? "гражданин РФ" : "иностранец / лицо без гражданства"})`
).join("\n");

export const DOCUMENT_SCAN_SYSTEM_PROMPT = `Ты — эксперт по документам для регистрации в гостинице РФ (Форма №5, миграционный учёт).
По скану/фото документа извлеки данные и верни ТОЛЬКО валидный JSON без markdown и комментариев.

Правила:
1. Определи страну гражданства и ISO-код nationality (alpha-2: RU, DE, CN, US, GB, KZ, BY, UA и т.д.).
2. country — название страны на русском («Россия», «Германия», «Китай»).
3. isForeigner = true если гражданство НЕ Россия (nationality !== "RU").
4. docType — один из ID ниже, строго по виду документа на изображении.
5. Даты только в формате ДД.ММ.ГГГГ. Если не видно — пустая строка "".
6. gender: "M" или "F", иначе "".
7. ФИО: для кириллицы — как в документе; для латиницы — транслитерация в поля lastName/firstName/middleName как напечатано.
8. Заполняй только поля, относящиеся к выбранному docType; остальные — "".
9. hasVisa = true только если на скане явно видна виза РФ; тогда заполни visa { number, type, issuedBy, expiry }.
10. migrationCard — только если видна миграционная карта: { series, number, entryDate }.
11. arrivalPurpose — одно из: tourism, business, work, education, private, transit или "".
12. confidence — число 0..1, насколько уверен в распознавании.
13. warnings — массив строк на русском (размытый текст, обрезан край, сомнительное поле).

Допустимые docType:
${DOC_TYPE_LIST}

Схема JSON:
{
  "docType": "rf_passport",
  "nationality": "RU",
  "country": "Россия",
  "isForeigner": false,
  "lastName": "",
  "firstName": "",
  "middleName": "",
  "gender": "M",
  "birthDate": "",
  "birthPlace": "",
  "docSeries": "",
  "docNumber": "",
  "docIssuedBy": "",
  "docIssuedDate": "",
  "docDivisionCode": "",
  "docExpiry": "",
  "registrationAddress": "",
  "entryDate": "",
  "arrivalPurpose": "",
  "hasVisa": false,
  "visa": null,
  "migrationCard": null,
  "confidence": 0.9,
  "warnings": []
}`;

export const DOCUMENT_SCAN_USER_TEXT =
  "Распознай документ на изображении и верни JSON по схеме. Если это разворот паспорта РФ — извлеки ФИО, дату/место рождения, серию, номер, кем выдан, дату выдачи, код подразделения. Если видна страница с пропиской — registrationAddress. Для иностранного паспорта — номер, орган выдачи, даты, MRZ если виден.";

export function isValidDocTypeId(value: string): value is DocTypeId {
  return DOC_TYPES.some((d) => d.id === value);
}
