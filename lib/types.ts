export type RoomStatus = "available" | "occupied" | "checkin" | "checkout" | "cleaning" | "maintenance";
export type RoomCategory = string;
export type BookingSource = "booking" | "expedia" | "direct" | "ostrovok" | "yandex";
export type BookingStatus = "new" | "confirmed" | "checkedin" | "checkedout" | "cancelled";
export type TxType = "payment" | "refund" | "service" | "encashment" | "expense";
export type CatalogKind = "service" | "expense";
export type PaymentMethod = string;
export type ServiceCat = "breakfast" | "laundry" | "slippers" | "minibar" | "parking" | "transfer_srv" | "sauna" | "extra";
export type UserRole = "owner" | "manager" | "admin" | "staff";
export type MigRegStatus = "not_required" | "pending" | "submitted" | "overdue";

export interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  stars: number;
  phone: string;
  email: string;
  legalName: string;
  website: string;
}

export interface StaffMember {
  id: string;
  userId?: string | null;
  name: string;
  role: UserRole;
  position: string;
  initials: string;
  hotelIds: string[];
  dayShiftRate?: number;
  nightShiftRate?: number;
  hkShiftRate?: number;
  hasAccount?: boolean;
}

export type RoomKind = "private" | "dorm";
export type DormGender = "male" | "female" | "mixed";

export interface Bed {
  id: string;
  roomId: string;
  hotelId: string;
  label: string;
  status: RoomStatus;
}

export interface Room {
  id: string;
  hotelId: string;
  number: string;
  kind: RoomKind;
  dormGender: DormGender | null;
  category: RoomCategory;
  floor: number;
  status: RoomStatus;
  price: number;
  amenities: string[];
}

export interface RoomCategoryDef {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export interface GuestDocument {
  id: string;
  type: string;
  name: string;
  size: string;
  pages: number;
  filePath?: string;
  uploadedAt: string;
}

export interface Guest {
  id: string;
  name: string;
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
  isForeigner: boolean;
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
  migRegRequired: boolean;
  migRegStatus: MigRegStatus;
  migRegDeadline: string;
  migRegSubmittedAt: string;
  migRegNotifNumber: string;
  visits: number;
  preferences: string;
  vip: boolean;
  totalSpent: number;
  regCardSigned: boolean;
  documents: GuestDocument[];
}

export interface Booking {
  id: string;
  hotelId: string;
  roomId: string;
  bedId?: string | null;
  guestId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  checkInHour: number;
  checkOutHour: number;
  source: BookingSource;
  channelId?: string | null;
  status: BookingStatus;
  amount: number;
  guests: number;
  paid: number;
  discountPercent?: number;
  discountPerNight?: number;
  notes: string;
  checkedOutAt?: Date | string | null;
}

export interface StayAmendment {
  id: string;
  bookingId: string;
  prevCheckOut: Date | string;
  prevAmount: number;
  prevNights: number;
  newCheckOut: Date | string;
  newAmount: number;
  nightDelta: number;
  amountDelta: number;
  createdAt: Date | string;
}

export type OrganizationStayStatus = "active" | "completed" | "cancelled";
export type OrganizationStayRoomStatus = "active" | "checked_out";

export interface OrganizationDocument {
  id: string;
  name: string;
  filePath: string;
  mimeType: string;
  size: string;
  uploadedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  inn: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes: string;
  skipWeeklyCleaning: boolean;
  totalSpent: number;
  documents: OrganizationDocument[];
  createdAt?: string;
}

export interface OrganizationStayRoom {
  id: string;
  organizationStayId: string;
  roomId: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  status: OrganizationStayRoomStatus;
  checkedOutAt?: Date | null;
}

export interface OrganizationStay {
  id: string;
  organizationId: string;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  status: OrganizationStayStatus;
  amount: number;
  paid: number;
  notes: string;
  rooms: OrganizationStayRoom[];
  createdAt?: string;
}

export interface PaymentMethodDef {
  id: string;
  code: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  category: ServiceCat;
  name: string;
  price: number;
  icon: string;
  active: boolean;
}

export interface HotelDiscountRule {
  id: string;
  hotelId: string;
  name: string;
  minNights: number;
  discountPercent: number;
  discountPerNight: number;
  paymentMethod: string | null;
  active: boolean;
  sortOrder: number;
}

export interface TransactionCategoryDef {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  hotelId: string;
  date: Date;
  type: TxType;
  category: string;
  paymentMethod: PaymentMethod;
  amount: number;
  bookingId?: string | null;
  organizationId?: string | null;
  organizationStayId?: string | null;
  guestName?: string | null;
  note?: string | null;
  roomNumber?: string | null;
  channelId?: string | null;
  cancelledAt?: Date | null;
  cancelledByUserId?: string | null;
  paymentNights?: number | null;
  discountRuleId?: string | null;
  discountPercentApplied?: number | null;
  discountPerNightApplied?: number | null;
}

export interface ServiceItem {
  id: string;
  kind?: CatalogKind;
  category: ServiceCat;
  name: string;
  price: number;
  icon: string;
  active?: boolean;
}

export type HkTaskStatus = "pending" | "in_progress" | "done";
export type HkPriority = "normal" | "high";
export type HkTaskCategory = "checkout" | "relocation" | "scheduled";
export type ChannelSyncStatus = "ok" | "err";

export interface HkTask {
  id: string;
  hotelId: string;
  roomId?: string | null;
  bookingId?: string | null;
  organizationStayId?: string | null;
  organizationStayRoomId?: string | null;
  roomNumber: string;
  type: string;
  category: HkTaskCategory;
  assignee: string;
  priority: HkPriority;
  status: HkTaskStatus;
  time: string;
  est: string;
  createdAt?: string;
}

export interface Channel {
  id: string;
  hotelId: string;
  name: string;
  code: string;
  color: string;
  status: ChannelSyncStatus;
  inventory: number;
  rate: number;
  commission: number;
  bookingsMonth: number;
  revenueMonth: number;
  lastSyncMin: number;
}
