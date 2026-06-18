-- CreateEnum
CREATE TYPE "UtilityMeterType" AS ENUM ('gvs', 'hvs', 'electricity');

-- CreateTable
CREATE TABLE "UtilityMeter" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "meterType" "UtilityMeterType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityReading" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "readingDate" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "transmitted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityReadingAttachment" (
    "id" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityReadingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtilityMeter_hotelId_idx" ON "UtilityMeter"("hotelId");
CREATE UNIQUE INDEX "UtilityMeter_hotelId_zoneName_meterType_key" ON "UtilityMeter"("hotelId", "zoneName", "meterType");
CREATE INDEX "UtilityReading_hotelId_idx" ON "UtilityReading"("hotelId");
CREATE INDEX "UtilityReading_readingDate_idx" ON "UtilityReading"("readingDate");
CREATE UNIQUE INDEX "UtilityReading_meterId_readingDate_key" ON "UtilityReading"("meterId", "readingDate");
CREATE INDEX "UtilityReadingAttachment_readingId_idx" ON "UtilityReadingAttachment"("readingId");

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "UtilityMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UtilityReadingAttachment" ADD CONSTRAINT "UtilityReadingAttachment_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "UtilityReading"("id") ON DELETE CASCADE ON UPDATE CASCADE;
