-- CreateTable
CREATE TABLE "NetworkFaq" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqChunk" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaqChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL DEFAULT '',
    "slots" JSONB NOT NULL DEFAULT '{}',
    "pendingAction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkFaq_seatId_key" ON "NetworkFaq"("seatId");

-- CreateIndex
CREATE INDEX "FaqChunk_faqId_idx" ON "FaqChunk"("faqId");

-- CreateIndex
CREATE INDEX "AssistantConversation_seatId_staffId_idx" ON "AssistantConversation"("seatId", "staffId");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_idx" ON "AssistantMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "NetworkFaq" ADD CONSTRAINT "NetworkFaq_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqChunk" ADD CONSTRAINT "FaqChunk_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "NetworkFaq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
