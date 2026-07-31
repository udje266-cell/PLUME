-- Sondages de groupe (votes). Table additive, idempotente.
CREATE TABLE IF NOT EXISTS "GroupPollVote" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupPollVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPollVote_messageId_userId_key" ON "GroupPollVote"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "GroupPollVote_messageId_idx" ON "GroupPollVote"("messageId");
