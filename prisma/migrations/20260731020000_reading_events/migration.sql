-- Telemetrie de lecture (Phase 0 recommandation). Table additive, idempotente.
CREATE TABLE IF NOT EXISTS "ReadingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "sessionId" TEXT,
    "trustAtTime" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReadingEvent_storyId_createdAt_idx" ON "ReadingEvent"("storyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReadingEvent_userId_createdAt_idx" ON "ReadingEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReadingEvent_type_createdAt_idx" ON "ReadingEvent"("type", "createdAt");
