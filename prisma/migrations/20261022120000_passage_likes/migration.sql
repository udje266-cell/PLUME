-- « J'aime » sur un passage. Table additive, idempotente.
CREATE TABLE IF NOT EXISTS "PassageLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassageLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PassageLike_userId_chapterId_paragraphIndex_key" ON "PassageLike"("userId", "chapterId", "paragraphIndex");
CREATE INDEX IF NOT EXISTS "PassageLike_chapterId_idx" ON "PassageLike"("chapterId");
