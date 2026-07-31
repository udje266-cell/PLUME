-- Agregats par recit (Phase 1 recommandation). Table additive, idempotente.
CREATE TABLE IF NOT EXISTS "StoryStats" (
    "storyId" TEXT NOT NULL,
    "starters" INTEGER NOT NULL DEFAULT 0,
    "finishers" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDwellSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "velocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryStats_pkey" PRIMARY KEY ("storyId")
);
