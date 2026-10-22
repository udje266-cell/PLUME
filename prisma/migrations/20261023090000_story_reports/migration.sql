-- Signalements d'œuvres par les lecteurs. Additif, idempotent.
CREATE TABLE IF NOT EXISTS "StoryReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoryReport_reporterId_storyId_key" ON "StoryReport"("reporterId", "storyId");
CREATE INDEX IF NOT EXISTS "StoryReport_storyId_idx" ON "StoryReport"("storyId");
