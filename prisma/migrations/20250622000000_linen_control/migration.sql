-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN "linenPillowcasesPerChange" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Hotel" ADD COLUMN "linenSheetsPerChange" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Hotel" ADD COLUMN "linenDuvetCoversPerChange" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Hotel" ADD COLUMN "linenEstimatedSets" INTEGER;

-- AlterTable
ALTER TABLE "HkTask" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LinenDelivery" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "pillowcases" INTEGER NOT NULL DEFAULT 0,
    "sheets" INTEGER NOT NULL DEFAULT 0,
    "duvetCovers" INTEGER NOT NULL DEFAULT 0,
    "washCost" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "invoicePath" TEXT NOT NULL DEFAULT '',
    "invoiceName" TEXT NOT NULL DEFAULT '',
    "invoiceSize" TEXT NOT NULL DEFAULT '',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "ocrSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinenDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinenDelivery_hotelId_idx" ON "LinenDelivery"("hotelId");
CREATE INDEX "LinenDelivery_deliveredAt_idx" ON "LinenDelivery"("deliveredAt");
CREATE INDEX "HkTask_completedAt_idx" ON "HkTask"("completedAt");

-- AddForeignKey
ALTER TABLE "LinenDelivery" ADD CONSTRAINT "LinenDelivery_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill completedAt for already done tasks
UPDATE "HkTask" SET "completedAt" = "updatedAt" WHERE "status" = 'done' AND "completedAt" IS NULL;
