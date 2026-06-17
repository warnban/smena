-- BotMigrationMap for idempotent imports from legacy CRM
CREATE TABLE IF NOT EXISTS "BotMigrationMap" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "botEntity" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotMigrationMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotMigrationMap_seatId_botEntity_botId_key" ON "BotMigrationMap"("seatId", "botEntity", "botId");
CREATE INDEX IF NOT EXISTS "BotMigrationMap_seatId_idx" ON "BotMigrationMap"("seatId");

DO $$ BEGIN
  ALTER TABLE "BotMigrationMap" ADD CONSTRAINT "BotMigrationMap_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
