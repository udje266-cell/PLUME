-- Etat de lecture partage entre appareils (app native et PWA) :
-- listes de lecture, chapitres reellement lus, citations sauvegardees.

CREATE TABLE IF NOT EXISTS "ReadingListEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingListEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReadingListEntry_userId_storyId_list_key" ON "ReadingListEntry"("userId", "storyId", "list");
CREATE INDEX IF NOT EXISTS "ReadingListEntry_userId_idx" ON "ReadingListEntry"("userId");

ALTER TABLE "ReadingListEntry" ADD CONSTRAINT "ReadingListEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ChapterRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterRead_userId_chapterId_key" ON "ChapterRead"("userId", "chapterId");
CREATE INDEX IF NOT EXISTS "ChapterRead_userId_idx" ON "ChapterRead"("userId");

ALTER TABLE "ChapterRead" ADD CONSTRAINT "ChapterRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SavedQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT,
    "chapterId" TEXT,
    "content" TEXT NOT NULL,
    "storyTitle" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedQuote_userId_idx" ON "SavedQuote"("userId");

ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
