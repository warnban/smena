-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('private', 'dorm');

-- CreateEnum
CREATE TYPE "DormGender" AS ENUM ('male', 'female', 'mixed');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "kind" "RoomKind" NOT NULL DEFAULT 'private';
ALTER TABLE "Room" ADD COLUMN "dormGender" "DormGender";

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "bedId" TEXT;

-- AlterTable
ALTER TABLE "HkTask" ADD COLUMN "bedId" TEXT;

-- CreateIndex
CREATE INDEX "Bed_hotelId_idx" ON "Bed"("hotelId");
CREATE INDEX "Bed_roomId_idx" ON "Bed"("roomId");
CREATE UNIQUE INDEX "Bed_roomId_label_key" ON "Bed"("roomId", "label");
CREATE INDEX "Booking_bedId_idx" ON "Booking"("bedId");
CREATE INDEX "HkTask_bedId_idx" ON "HkTask"("bedId");

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HkTask" ADD CONSTRAINT "HkTask_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
