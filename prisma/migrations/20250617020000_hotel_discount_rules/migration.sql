-- CreateTable
CREATE TABLE "HotelDiscountRule" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "minNights" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "discountPerNight" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelDiscountRule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paymentNights" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "discountRuleId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "discountPercentApplied" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "discountPerNightApplied" INTEGER;

-- AlterTable
ALTER TABLE "RefundRecord" ADD COLUMN "withholdNights" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundRecord" ADD COLUMN "recalcNote" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "HotelDiscountRule_hotelId_idx" ON "HotelDiscountRule"("hotelId");

-- AddForeignKey
ALTER TABLE "HotelDiscountRule" ADD CONSTRAINT "HotelDiscountRule_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "HotelDiscountRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
