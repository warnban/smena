-- CreateTable
CREATE TABLE "TransactionCategoryDef" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionCategoryDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategoryDef_seatId_code_key" ON "TransactionCategoryDef"("seatId", "code");

-- CreateIndex
CREATE INDEX "TransactionCategoryDef_seatId_idx" ON "TransactionCategoryDef"("seatId");

-- AddForeignKey
ALTER TABLE "TransactionCategoryDef" ADD CONSTRAINT "TransactionCategoryDef_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
