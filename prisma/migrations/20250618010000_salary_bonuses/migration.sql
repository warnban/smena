-- CreateEnum
CREATE TYPE "KpiMetric" AS ENUM ('revpar', 'occupancy', 'cash_revenue', 'total_revenue', 'adr');
CREATE TYPE "BonusRunStatus" AS ENUM ('draft', 'paid');

-- AlterEnum
ALTER TYPE "SalaryEntryType" ADD VALUE 'penalty';

-- CreateTable
CREATE TABLE "OccupancyRateTier" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "minOccupancy" INTEGER NOT NULL,
    "maxOccupancy" INTEGER NOT NULL,
    "dayRate" INTEGER NOT NULL,
    "nightRate" INTEGER NOT NULL,
    "hkRate" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OccupancyRateTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiBonusRule" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "metric" "KpiMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "bonusAmount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "KpiBonusRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BonusCalculationRun" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "status" "BonusRunStatus" NOT NULL DEFAULT 'draft',
    "kpiSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "BonusCalculationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BonusCalculationLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "included" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "BonusCalculationLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalaryLedgerEntry" ADD COLUMN "bonusRunId" TEXT;

CREATE INDEX "OccupancyRateTier_hotelId_idx" ON "OccupancyRateTier"("hotelId");
CREATE INDEX "KpiBonusRule_hotelId_idx" ON "KpiBonusRule"("hotelId");
CREATE INDEX "BonusCalculationRun_hotelId_periodMonth_idx" ON "BonusCalculationRun"("hotelId", "periodMonth");
CREATE INDEX "BonusCalculationLine_runId_idx" ON "BonusCalculationLine"("runId");
CREATE INDEX "BonusCalculationLine_staffId_idx" ON "BonusCalculationLine"("staffId");
CREATE INDEX "SalaryLedgerEntry_bonusRunId_idx" ON "SalaryLedgerEntry"("bonusRunId");

ALTER TABLE "OccupancyRateTier" ADD CONSTRAINT "OccupancyRateTier_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KpiBonusRule" ADD CONSTRAINT "KpiBonusRule_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BonusCalculationRun" ADD CONSTRAINT "BonusCalculationRun_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BonusCalculationLine" ADD CONSTRAINT "BonusCalculationLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BonusCalculationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BonusCalculationLine" ADD CONSTRAINT "BonusCalculationLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryLedgerEntry" ADD CONSTRAINT "SalaryLedgerEntry_bonusRunId_fkey" FOREIGN KEY ("bonusRunId") REFERENCES "BonusCalculationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
