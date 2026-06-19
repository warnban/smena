-- BookingSourceDef + migrate Booking.source from enum to text

CREATE TABLE "BookingSourceDef" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#D97706',
    "bg" TEXT NOT NULL DEFAULT '#FEF3C7',
    "text" TEXT NOT NULL DEFAULT '#92400E',
    "border" TEXT NOT NULL DEFAULT '#FDE68A',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSourceDef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingSourceDef_seatId_code_key" ON "BookingSourceDef"("seatId", "code");
CREATE INDEX "BookingSourceDef_seatId_idx" ON "BookingSourceDef"("seatId");

ALTER TABLE "BookingSourceDef" ADD CONSTRAINT "BookingSourceDef_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "source" TYPE TEXT USING "source"::TEXT;
ALTER TABLE "Booking" ALTER COLUMN "source" SET DEFAULT 'direct';

DROP TYPE "BookingSource";
