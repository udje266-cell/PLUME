-- Analyse IA de contenu + score de confiance (Phase 3). Tables additives.
CREATE TABLE IF NOT EXISTS "StoryContentAI" (
    "storyId" TEXT NOT NULL,
    "themes" JSONB,
    "keywords" JSONB,
    "emotion" TEXT,
    "pacing" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "narration" TEXT,
    "model" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryContentAI_pkey" PRIMARY KEY ("storyId")
);
CREATE TABLE IF NOT EXISTS "TrustScore" (
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "signals" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("userId")
);
