-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('available', 'occupied', 'checkin', 'checkout', 'cleaning', 'maintenance');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('booking', 'expedia', 'direct', 'ostrovok', 'yandex');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('new', 'confirmed', 'checkedin', 'checkedout', 'cancelled');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('payment', 'refund', 'service', 'encashment', 'expense');

-- CreateEnum
CREATE TYPE "CatalogKind" AS ENUM ('service', 'expense');

-- CreateEnum
CREATE TYPE "ServiceCat" AS ENUM ('breakfast', 'laundry', 'slippers', 'minibar', 'parking', 'transfer_srv', 'sauna', 'extra');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'admin', 'staff');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "MigRegStatus" AS ENUM ('not_required', 'pending', 'submitted', 'overdue');

-- CreateEnum
CREATE TYPE "HkTaskStatus" AS ENUM ('pending', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "HkPriority" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "HkTaskCategory" AS ENUM ('checkout', 'relocation', 'scheduled');

-- CreateEnum
CREATE TYPE "OrganizationStayStatus" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrganizationStayRoomStatus" AS ENUM ('active', 'checked_out');

-- CreateEnum
CREATE TYPE "ChannelSyncStatus" AS ENUM ('ok', 'err');

-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('day_admin', 'night_admin', 'housekeeping');

-- CreateEnum
CREATE TYPE "SalaryEntryType" AS ENUM ('accrual', 'payment', 'bonus');

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "seatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 3,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "position" TEXT NOT NULL DEFAULT '',
    "initials" TEXT NOT NULL DEFAULT '',
    "dayShiftRate" INTEGER NOT NULL DEFAULT 2500,
    "nightShiftRate" INTEGER NOT NULL DEFAULT 3000,
    "hkShiftRate" INTEGER NOT NULL DEFAULT 1800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOnHotel" (
    "staffId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "StaffOnHotel_pkey" PRIMARY KEY ("staffId","hotelId")
);

-- CreateTable
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "hotelIds" TEXT[],
    "email" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Double',
    "floor" INTEGER NOT NULL DEFAULT 1,
    "status" "RoomStatus" NOT NULL DEFAULT 'available',
    "price" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL DEFAULT '',
    "middleName" TEXT NOT NULL DEFAULT '',
    "gender" "Gender" NOT NULL DEFAULT 'M',
    "birthDate" TEXT NOT NULL DEFAULT '',
    "birthPlace" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '╨а╨╛╤Б╤Б╨╕╤П',
    "nationality" TEXT NOT NULL DEFAULT 'RU',
    "isForeigner" BOOLEAN NOT NULL DEFAULT false,
    "docType" TEXT NOT NULL DEFAULT 'rf_passport',
    "docSeries" TEXT NOT NULL DEFAULT '',
    "docNumber" TEXT NOT NULL DEFAULT '',
    "docIssuedBy" TEXT NOT NULL DEFAULT '',
    "docIssuedDate" TEXT NOT NULL DEFAULT '',
    "docDivisionCode" TEXT NOT NULL DEFAULT '',
    "docExpiry" TEXT NOT NULL DEFAULT '',
    "registrationAddress" TEXT NOT NULL DEFAULT '',
    "arrivalPurpose" TEXT NOT NULL DEFAULT '',
    "entryDate" TEXT NOT NULL DEFAULT '',
    "visa" JSONB,
    "migrationCard" JSONB,
    "migRegRequired" BOOLEAN NOT NULL DEFAULT false,
    "migRegStatus" "MigRegStatus" NOT NULL DEFAULT 'not_required',
    "migRegDeadline" TEXT NOT NULL DEFAULT '',
    "migRegSubmittedAt" TEXT NOT NULL DEFAULT '',
    "migRegNotifNumber" TEXT NOT NULL DEFAULT '',
    "visits" INTEGER NOT NULL DEFAULT 0,
    "preferences" TEXT NOT NULL DEFAULT '',
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "regCardSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT NOT NULL DEFAULT '',
    "contactPerson" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "skipWeeklyCleaning" BOOLEAN NOT NULL DEFAULT false,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationStay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" "OrganizationStayStatus" NOT NULL DEFAULT 'active',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationStayRoom" (
    "id" TEXT NOT NULL,
    "organizationStayId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" "OrganizationStayRoomStatus" NOT NULL DEFAULT 'active',
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationStayRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestDocument" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'passport',
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "pages" INTEGER NOT NULL DEFAULT 1,
    "filePath" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "checkInHour" INTEGER NOT NULL DEFAULT 14,
    "checkOutHour" INTEGER NOT NULL DEFAULT 12,
    "source" "BookingSource" NOT NULL DEFAULT 'direct',
    "channelId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'new',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "discountPerNight" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodDef" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#059669',
    "bg" TEXT NOT NULL DEFAULT '#F0FDF4',
    "icon" TEXT NOT NULL DEFAULT 'Banknote',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomCategoryDef" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCategoryDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "seatId" TEXT,
    "kind" "CatalogKind" NOT NULL DEFAULT 'service',
    "category" "ServiceCat" NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayAdminName" TEXT NOT NULL DEFAULT '',
    "nightAdminName" TEXT NOT NULL DEFAULT '',
    "occupancy" INTEGER NOT NULL DEFAULT 0,
    "cashOpening" INTEGER NOT NULL DEFAULT 0,
    "cashClosing" INTEGER NOT NULL DEFAULT 0,
    "accommodationTotal" INTEGER NOT NULL DEFAULT 0,
    "grandTotal" INTEGER NOT NULL DEFAULT 0,
    "expensesTotal" INTEGER NOT NULL DEFAULT 0,
    "encashmentTotal" INTEGER NOT NULL DEFAULT 0,
    "byPayment" JSONB NOT NULL DEFAULT '[]',
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyShiftLog" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayAdminName" TEXT NOT NULL DEFAULT '',
    "nightAdminName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DailyShiftLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleEntry" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "ShiftRole" NOT NULL,

    CONSTRAINT "WorkScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryLedgerEntry" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "SalaryEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "shiftRole" "ShiftRole",
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSale" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT,
    "serviceId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL DEFAULT '',
    "serviceName" TEXT NOT NULL,
    "serviceCategory" "ServiceCat" NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',

    CONSTRAINT "ServiceSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TxType" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'accommodation',
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "bookingId" TEXT,
    "organizationId" TEXT,
    "organizationStayId" TEXT,
    "guestName" TEXT,
    "note" TEXT,
    "roomNumber" TEXT,
    "channelId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HkTask" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT,
    "bookingId" TEXT,
    "organizationStayId" TEXT,
    "organizationStayRoomId" TEXT,
    "roomNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" "HkTaskCategory" NOT NULL DEFAULT 'checkout',
    "assignee" TEXT NOT NULL,
    "priority" "HkPriority" NOT NULL DEFAULT 'normal',
    "status" "HkTaskStatus" NOT NULL DEFAULT 'pending',
    "time" TEXT NOT NULL DEFAULT '',
    "est" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#16A34A',
    "status" "ChannelSyncStatus" NOT NULL DEFAULT 'ok',
    "inventory" INTEGER NOT NULL DEFAULT 0,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "bookingsMonth" INTEGER NOT NULL DEFAULT 0,
    "revenueMonth" INTEGER NOT NULL DEFAULT 0,
    "lastSyncMin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "documentPath" TEXT NOT NULL DEFAULT '',
    "documentName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seat_ownerId_key" ON "Seat"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_seatId_idx" ON "User"("seatId");

-- CreateIndex
CREATE INDEX "Hotel_seatId_idx" ON "Hotel"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "Staff_seatId_idx" ON "Staff"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvite_token_key" ON "StaffInvite"("token");

-- CreateIndex
CREATE INDEX "StaffInvite_seatId_idx" ON "StaffInvite"("seatId");

-- CreateIndex
CREATE INDEX "StaffInvite_token_idx" ON "StaffInvite"("token");

-- CreateIndex
CREATE INDEX "Room_hotelId_idx" ON "Room"("hotelId");

-- CreateIndex
CREATE INDEX "Guest_seatId_idx" ON "Guest"("seatId");

-- CreateIndex
CREATE INDEX "Guest_isForeigner_idx" ON "Guest"("isForeigner");

-- CreateIndex
CREATE INDEX "Organization_seatId_idx" ON "Organization"("seatId");

-- CreateIndex
CREATE INDEX "OrganizationDocument_organizationId_idx" ON "OrganizationDocument"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationStay_organizationId_idx" ON "OrganizationStay"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationStay_hotelId_idx" ON "OrganizationStay"("hotelId");

-- CreateIndex
CREATE INDEX "OrganizationStay_status_idx" ON "OrganizationStay"("status");

-- CreateIndex
CREATE INDEX "OrganizationStayRoom_organizationStayId_idx" ON "OrganizationStayRoom"("organizationStayId");

-- CreateIndex
CREATE INDEX "OrganizationStayRoom_roomId_idx" ON "OrganizationStayRoom"("roomId");

-- CreateIndex
CREATE INDEX "OrganizationStayRoom_status_idx" ON "OrganizationStayRoom"("status");

-- CreateIndex
CREATE INDEX "GuestDocument_guestId_idx" ON "GuestDocument"("guestId");

-- CreateIndex
CREATE INDEX "Booking_hotelId_idx" ON "Booking"("hotelId");

-- CreateIndex
CREATE INDEX "Booking_roomId_idx" ON "Booking"("roomId");

-- CreateIndex
CREATE INDEX "Booking_guestId_idx" ON "Booking"("guestId");

-- CreateIndex
CREATE INDEX "Booking_channelId_idx" ON "Booking"("channelId");

-- CreateIndex
CREATE INDEX "PaymentMethodDef_seatId_idx" ON "PaymentMethodDef"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodDef_seatId_code_key" ON "PaymentMethodDef"("seatId", "code");

-- CreateIndex
CREATE INDEX "RoomCategoryDef_seatId_idx" ON "RoomCategoryDef"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCategoryDef_seatId_code_key" ON "RoomCategoryDef"("seatId", "code");

-- CreateIndex
CREATE INDEX "Service_seatId_idx" ON "Service"("seatId");

-- CreateIndex
CREATE INDEX "Service_kind_idx" ON "Service"("kind");

-- CreateIndex
CREATE INDEX "DailyReport_hotelId_idx" ON "DailyReport"("hotelId");

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_hotelId_date_key" ON "DailyReport"("hotelId", "date");

-- CreateIndex
CREATE INDEX "DailyShiftLog_hotelId_idx" ON "DailyShiftLog"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyShiftLog_hotelId_date_key" ON "DailyShiftLog"("hotelId", "date");

-- CreateIndex
CREATE INDEX "WorkScheduleEntry_hotelId_date_idx" ON "WorkScheduleEntry"("hotelId", "date");

-- CreateIndex
CREATE INDEX "WorkScheduleEntry_staffId_idx" ON "WorkScheduleEntry"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryLedgerEntry_transactionId_key" ON "SalaryLedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "SalaryLedgerEntry_staffId_idx" ON "SalaryLedgerEntry"("staffId");

-- CreateIndex
CREATE INDEX "SalaryLedgerEntry_hotelId_idx" ON "SalaryLedgerEntry"("hotelId");

-- CreateIndex
CREATE INDEX "SalaryLedgerEntry_date_idx" ON "SalaryLedgerEntry"("date");

-- CreateIndex
CREATE INDEX "ServiceSale_hotelId_idx" ON "ServiceSale"("hotelId");

-- CreateIndex
CREATE INDEX "Transaction_hotelId_idx" ON "Transaction"("hotelId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "HkTask_hotelId_idx" ON "HkTask"("hotelId");

-- CreateIndex
CREATE INDEX "HkTask_status_idx" ON "HkTask"("status");

-- CreateIndex
CREATE INDEX "HkTask_bookingId_idx" ON "HkTask"("bookingId");

-- CreateIndex
CREATE INDEX "Channel_hotelId_idx" ON "Channel"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_hotelId_code_key" ON "Channel"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_transactionId_key" ON "RefundRecord"("transactionId");

-- CreateIndex
CREATE INDEX "RefundRecord_hotelId_idx" ON "RefundRecord"("hotelId");

-- CreateIndex
CREATE INDEX "RefundRecord_bookingId_idx" ON "RefundRecord"("bookingId");

-- CreateIndex
CREATE INDEX "RefundRecord_createdAt_idx" ON "RefundRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnHotel" ADD CONSTRAINT "StaffOnHotel_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnHotel" ADD CONSTRAINT "StaffOnHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStay" ADD CONSTRAINT "OrganizationStay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStay" ADD CONSTRAINT "OrganizationStay_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStayRoom" ADD CONSTRAINT "OrganizationStayRoom_organizationStayId_fkey" FOREIGN KEY ("organizationStayId") REFERENCES "OrganizationStay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationStayRoom" ADD CONSTRAINT "OrganizationStayRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodDef" ADD CONSTRAINT "PaymentMethodDef_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCategoryDef" ADD CONSTRAINT "RoomCategoryDef_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyShiftLog" ADD CONSTRAINT "DailyShiftLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryLedgerEntry" ADD CONSTRAINT "SalaryLedgerEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryLedgerEntry" ADD CONSTRAINT "SalaryLedgerEntry_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryLedgerEntry" ADD CONSTRAINT "SalaryLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSale" ADD CONSTRAINT "ServiceSale_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSale" ADD CONSTRAINT "ServiceSale_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSale" ADD CONSTRAINT "ServiceSale_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationStayId_fkey" FOREIGN KEY ("organizationStayId") REFERENCES "OrganizationStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_organizationStayId_fkey" FOREIGN KEY ("organizationStayId") REFERENCES "OrganizationStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_organizationStayRoomId_fkey" FOREIGN KEY ("organizationStayRoomId") REFERENCES "OrganizationStayRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

