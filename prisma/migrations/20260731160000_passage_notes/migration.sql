-- Annotations de lecture (surlignage + note). Table additive, idempotente.
CREATE TABLE IF NOT EXISTS "PassageNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "color" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PassageNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PassageNote_userId_chapterId_paragraphIndex_key" ON "PassageNote"("userId", "chapterId", "paragraphIndex");
CREATE INDEX IF NOT EXISTS "PassageNote_userId_storyId_idx" ON "PassageNote"("userId", "storyId");
