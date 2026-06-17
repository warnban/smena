import { fmtDateRu, dayDiff, money } from "@/lib/format";
import { mskNightDiff } from "@/lib/msk-time";
import type { Booking, Guest, Hotel, Room } from "@/lib/types";

export type GuestFormId =
  | "pd-consent"
  | "hotel-rules"
  | "refund-form"
  | "hotel-contract"
  | "hotel-contract-amendment";

export const STAY_AMENDMENT_FORM_ID: GuestFormId = "hotel-contract-amendment";

export type StayAmendmentPrevious = {
  checkOut: Date | string;
  amount: number;
  nights: number;
};

export const GUEST_FORM_TEMPLATES: Record<
  GuestFormId,
  { id: GuestFormId; label: string; filename: string }
> = {
  "pd-consent": {
    id: "pd-consent",
    label: "Согласие на обработку персональных данных",
    filename: "personal-data-consent.docx",
  },
  "hotel-rules": {
    id: "hotel-rules",
    label: "Правила проживания в гостинице",
    filename: "hotel-rules.docx",
  },
  "refund-form": {
    id: "refund-form",
    label: "Бланк возврата денежных средств",
    filename: "refund-form.docx",
  },
  "hotel-contract": {
    id: "hotel-contract",
    label: "Договор на оказание гостиничных услуг",
    filename: "hotel-services-contract.docx",
  },
  "hotel-contract-amendment": {
    id: "hotel-contract-amendment",
    label: "Дополнительное соглашение к договору",
    filename: "hotel-contract-amendment.docx",
  },
};

/** Бланки, доступные для ручной печати из карточки гостя (без доп. соглашения). */
export const GUEST_MANUAL_PRINT_FORM_IDS: GuestFormId[] = (
  Object.keys(GUEST_FORM_TEMPLATES) as GuestFormId[]
).filter((id) => id !== STAY_AMENDMENT_FORM_ID);

/** Бланки для печати при заселении (порядок важен) */
export const CHECK_IN_PRINT_FORM_IDS: GuestFormId[] = [
  "pd-consent",
  "hotel-rules",
  "hotel-contract",
];

export function buildGuestFormsPrintUrl(params: {
  guestId: string;
  bookingId: string;
  formIds?: GuestFormId[];
  autoPrint?: boolean;
}): string {
  const q = new URLSearchParams({
    guestId: params.guestId,
    bookingId: params.bookingId,
    formIds: (params.formIds ?? CHECK_IN_PRINT_FORM_IDS).join(","),
    print: params.autoPrint === false ? "0" : "1",
  });
  return `/guests/form-print?${q.toString()}`;
}

export function parseGuestFormIds(raw: string | null): GuestFormId[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id): id is GuestFormId => id in GUEST_FORM_TEMPLATES);
}

export const GUEST_FORM_VARIABLES: { key: string; description: string }[] = [
  { key: "guest_fio", description: "ФИО гостя полностью" },
  { key: "guest_last_name", description: "Фамилия" },
  { key: "guest_first_name", description: "Имя" },
  { key: "guest_middle_name", description: "Отчество" },
  { key: "guest_phone", description: "Телефон гостя" },
  { key: "guest_email", description: "Email гостя" },
  { key: "guest_passport", description: "Паспорт: серия и номер" },
  { key: "guest_doc_issued_by", description: "Паспорт: кем выдан" },
  { key: "guest_doc_issued_date", description: "Паспорт: дата выдачи" },
  { key: "guest_registration_address", description: "Адрес регистрации (прописка)" },
  { key: "guest_birth_date", description: "Дата рождения" },
  { key: "hotel_name", description: "Название гостиницы (как в CRM)" },
  { key: "hotel_legal_name", description: "Юридическое название (ИП / ООО)" },
  { key: "hotel_website", description: "Сайт гостиницы" },
  { key: "hotel_address", description: "Адрес" },
  { key: "hotel_city", description: "Город" },
  { key: "hotel_phone", description: "Телефон отеля" },
  { key: "hotel_email", description: "Email отеля" },
  { key: "check_in", description: "Дата заезда" },
  { key: "check_out", description: "Дата выезда" },
  { key: "stay_period", description: "Период проживания (заезд — выезд)" },
  { key: "room_number", description: "Номер комнаты" },
  { key: "nights", description: "Количество ночей" },
  { key: "contract_number", description: "Номер договора (номер комнаты + дата заезда)" },
  { key: "booking_amount", description: "Стоимость проживания по бронированию" },
  { key: "booking_paid", description: "Оплачено по бронированию" },
  { key: "booking_balance", description: "Остаток к оплате" },
  { key: "check_in_time", description: "Время заезда (час)" },
  { key: "check_out_time", description: "Время выезда (час)" },
  { key: "print_date", description: "Дата формирования документа" },
  { key: "contract_date", description: "Дата заключения основного договора (заезд)" },
  { key: "amendment_number", description: "Номер дополнительного соглашения" },
  { key: "prev_check_out", description: "Прежняя дата выезда" },
  { key: "prev_stay_period", description: "Прежний период проживания" },
  { key: "prev_nights", description: "Прежнее количество суток" },
  { key: "prev_booking_amount", description: "Прежняя стоимость по договору" },
  { key: "new_check_out", description: "Новая дата выезда" },
  { key: "new_stay_period", description: "Новый период проживания" },
  { key: "new_nights", description: "Новое количество суток" },
  { key: "new_booking_amount", description: "Новая стоимость по договору" },
  { key: "amount_delta", description: "Изменение стоимости (+/−)" },
  { key: "night_delta", description: "Изменение суток (+/−)" },
  { key: "change_type", description: "продление / сокращение" },
  { key: "change_summary", description: "Краткое описание изменения" },
];

function moneyDelta(delta: number): string {
  if (delta === 0) return money(0);
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${money(Math.abs(delta))}`;
}

function signedInt(delta: number): string {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function buildGuestFormContext(
  guest: Pick<
    Guest,
    | "name"
    | "lastName"
    | "firstName"
    | "middleName"
    | "phone"
    | "email"
    | "birthDate"
    | "docSeries"
    | "docNumber"
    | "docIssuedBy"
    | "docIssuedDate"
    | "registrationAddress"
  >,
  hotel: Hotel,
  booking: Pick<Booking, "checkIn" | "checkOut" | "amount" | "paid" | "checkInHour" | "checkOutHour">,
  room?: Room | null
): Record<string, string> {
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const passport = [guest.docSeries, guest.docNumber].filter(Boolean).join(" ").trim();
  const roomNumber = room?.number ?? "—";

  return {
    guest_fio: guest.name,
    guest_last_name: guest.lastName,
    guest_first_name: guest.firstName,
    guest_middle_name: guest.middleName,
    guest_phone: guest.phone,
    guest_email: guest.email,
    guest_passport: passport || "—",
    guest_doc_issued_by: guest.docIssuedBy || "—",
    guest_doc_issued_date: guest.docIssuedDate || "—",
    guest_registration_address: guest.registrationAddress || "—",
    guest_birth_date: guest.birthDate || "—",
    hotel_name: hotel.name,
    hotel_legal_name: hotel.legalName || hotel.name,
    hotel_website: hotel.website,
    hotel_address: hotel.address,
    hotel_city: hotel.city,
    hotel_phone: hotel.phone,
    hotel_email: hotel.email,
    check_in: fmtDateRu(checkIn),
    check_out: fmtDateRu(checkOut),
    stay_period: `${fmtDateRu(checkIn)} — ${fmtDateRu(checkOut)}`,
    room_number: roomNumber,
    nights: String(Math.max(1, dayDiff(checkIn, checkOut))),
    contract_number: `${roomNumber}-${fmtDateRu(checkIn).replace(/\./g, "")}`,
    booking_amount: money(booking.amount),
    booking_paid: money(booking.paid),
    booking_balance: money(Math.max(0, booking.amount - booking.paid)),
    check_in_time: `${String(booking.checkInHour).padStart(2, "0")}:00`,
    check_out_time: `${String(booking.checkOutHour).padStart(2, "0")}:00`,
    print_date: fmtDateRu(new Date()),
  };
}

export function buildStayAmendmentContext(
  base: Record<string, string>,
  previous: StayAmendmentPrevious,
  booking: Pick<Booking, "checkIn" | "checkOut" | "amount" | "paid" | "checkOutHour">
): Record<string, string> {
  const checkIn = new Date(booking.checkIn);
  const prevCheckOut = new Date(previous.checkOut);
  const newCheckOut = new Date(booking.checkOut);
  const extended = newCheckOut.getTime() > prevCheckOut.getTime();
  const nightDelta = mskNightDiff(booking.checkIn, booking.checkOut) - previous.nights;
  const amountDelta = booking.amount - previous.amount;
  const contractDate = fmtDateRu(checkIn);
  const printCompact = fmtDateRu(new Date()).replace(/\./g, "");

  const changeType = extended ? "продлении" : "сокращении";
  const changeTypeNoun = extended ? "продление" : "сокращение";

  return {
    ...base,
    contract_date: contractDate,
    amendment_number: `${base.contract_number}-ДС-${printCompact}`,
    prev_check_out: fmtDateRu(prevCheckOut),
    prev_stay_period: `${fmtDateRu(checkIn)} — ${fmtDateRu(prevCheckOut)}`,
    prev_nights: String(previous.nights),
    prev_booking_amount: money(previous.amount),
    new_check_out: base.check_out,
    new_stay_period: base.stay_period,
    new_nights: base.nights,
    new_booking_amount: base.booking_amount,
    amount_delta: moneyDelta(amountDelta),
    night_delta: signedInt(nightDelta),
    change_type: changeTypeNoun,
    change_reason: extended ? "продлением" : "сокращением",
    change_summary: `Стороны согласовали ${changeType} срока проживания с ${fmtDateRu(prevCheckOut)} до ${base.check_out} (${signedInt(nightDelta)} сут., стоимость ${moneyDelta(amountDelta)}).`,
  };
}

export function buildStayAmendmentPrintUrl(params: {
  guestId: string;
  bookingId: string;
  previous: StayAmendmentPrevious;
  autoPrint?: boolean;
}): string {
  const q = new URLSearchParams({
    guestId: params.guestId,
    bookingId: params.bookingId,
    formIds: STAY_AMENDMENT_FORM_ID,
    print: params.autoPrint === false ? "0" : "1",
    prevCheckOut: new Date(params.previous.checkOut).toISOString().slice(0, 10),
    prevAmount: String(Math.round(params.previous.amount)),
    prevNights: String(params.previous.nights),
  });
  return `/guests/form-print?${q.toString()}`;
}

export function parseStayAmendmentFromSearchParams(
  sp: URLSearchParams
): StayAmendmentPrevious | null {
  const prevCheckOut = sp.get("prevCheckOut");
  const prevAmount = sp.get("prevAmount");
  const prevNights = sp.get("prevNights");
  if (!prevCheckOut || !prevAmount || !prevNights) return null;
  return {
    checkOut: prevCheckOut,
    amount: Math.round(Number(prevAmount)),
    nights: Math.max(1, Math.round(Number(prevNights))),
  };
}

type BookingLike = Pick<
  Booking,
  "id" | "guestId" | "status" | "checkIn" | "checkOut" | "hotelId" | "roomId" | "amount" | "paid" | "checkInHour" | "checkOutHour"
>;

export function pickGuestBookingForForms(
  bookings: BookingLike[],
  guestId: string
): BookingLike | null {
  const list = bookings
    .filter((b) => b.guestId === guestId && b.status !== "cancelled")
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());

  if (!list.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkedIn = list.find((b) => b.status === "checkedin");
  if (checkedIn) return checkedIn;

  const upcoming = list.find((b) => {
    const co = new Date(b.checkOut);
    co.setHours(0, 0, 0, 0);
    return co >= today && (b.status === "new" || b.status === "confirmed");
  });
  if (upcoming) return upcoming;

  return list[0];
}
