/** Типы пакета экспорта из legacy CRM (bot) — версия 1 */

export type BotMigrationExportV1 = {
  version: 1;
  exportedAt: string;
  fromDate: string;
  network: { id: string; name: string };
  objects: { id: string; name: string; description: string | null }[];
  paymentTypesByObject: Record<string, string[]>;
  rooms: { id: string; objectId: string; name: string }[];
  beds: { id: string; objectId: string; roomId: string | null; name: string; status: string }[];
  guests: BotMigrationGuest[];
  transactions: BotMigrationTransaction[];
  stats: {
    guestCount: number;
    transactionCount: number;
    incomeTotal: number;
    expenseTotal: number;
    livingCount: number;
  };
};

export type BotMigrationGuest = {
  id: string;
  objectId: string;
  fullName: string;
  isForeigner: boolean | null;
  isLiving: boolean;
  checkInDate: string;
  checkOutDate: string | null;
  bookingStartDate: string | null;
  bookingEndDate: string | null;
  dailyRate: number | null;
  paidDays: number;
  bedNumber: string | null;
  roomNumber: string | null;
  notes: string | null;
  activeStay: {
    bedId: string;
    bedName: string;
    checkInDate: string;
    checkOutDate: string | null;
  } | null;
};

export type BotMigrationTransaction = {
  id: string;
  objectId: string;
  guestPassportId: string | null;
  type: string;
  amount: number;
  category: string | null;
  paymentType: string | null;
  payer: string | null;
  comment: string | null;
  date: string;
};

export type BotNetworkListItem = {
  id: string;
  name: string;
  objectCount: number;
};
