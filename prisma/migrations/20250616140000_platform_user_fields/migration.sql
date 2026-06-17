-- AlterTable
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "devPasswordPlain" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "User_isBlocked_idx" ON "User"("isBlocked");
