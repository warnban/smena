-- CreateTable
CREATE TABLE "StayAmendment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "prevCheckOut" TIMESTAMP(3) NOT NULL,
    "prevAmount" INTEGER NOT NULL,
    "prevNights" INTEGER NOT NULL,
    "newCheckOut" TIMESTAMP(3) NOT NULL,
    "newAmount" INTEGER NOT NULL,
    "nightDelta" INTEGER NOT NULL,
    "amountDelta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StayAmendment_bookingId_idx" ON "StayAmendment"("bookingId");

-- CreateIndex
CREATE INDEX "StayAmendment_createdAt_idx" ON "StayAmendment"("createdAt");

-- AddForeignKey
ALTER TABLE "StayAmendment" ADD CONSTRAINT "StayAmendment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
