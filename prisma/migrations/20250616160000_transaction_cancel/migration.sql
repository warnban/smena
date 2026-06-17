-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "cancelledByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_cancelledAt_idx" ON "Transaction"("cancelledAt");
