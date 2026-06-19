export type ExcelGuestRow = {
  hotelName: string;
  group: string;
  fullName: string;
  profileIds: string[];
  place: string;
  stayPeriod: string;
  payDate: string;
  amount: number;
  paymentMethod: string;
  payPeriod: string;
  comment: string;
};

export type ExcelOtherRow = {
  hotelName: string;
  date: string;
  type: string;
  category: string;
  amount: number;
  paymentMethod: string;
  payer: string;
  receiver: string;
  comment: string;
};

export type ExcelDupRow = {
  hotelName: string;
  group: string;
  canonicalName: string;
  profileIds: string[];
  reason: string;
};

export type ExcelWorkbookData = {
  guestRows: ExcelGuestRow[];
  otherRows: ExcelOtherRow[];
  dupRows: ExcelDupRow[];
  hotelNames: string[];
};

export type CrmPlaceSlot = {
  roomId: string;
  bedId: string | null;
  kind: "private" | "dorm";
  label: string;
  searchKeys: string[];
};

export type PlaceMatch = {
  excelPlace: string;
  hotelId: string;
  roomId: string | null;
  bedId: string | null;
  crmLabel: string | null;
  score: number;
  method: "exact" | "rule" | "embedding" | "unmatched";
};

export type ExcelPreviewResult = {
  hotels: Array<{ excelName: string; hotelId: string | null; crmName: string | null }>;
  stats: {
    guestPayments: number;
    otherTransactions: number;
    uniqueGuests: number;
    duplicateGroups: number;
    incomeTotal: number;
    expenseTotal: number;
    zeroPayments: number;
    livingGuests: number;
  };
  placeMatches: PlaceMatch[];
  unmatchedPlaces: string[];
  unmatchedHotels: string[];
  paymentMethods: string[];
  dateRange: { from: string; to: string } | null;
};

export type ExcelImportResult = {
  ok: true;
  created: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
  stats: ExcelPreviewResult["stats"];
};
