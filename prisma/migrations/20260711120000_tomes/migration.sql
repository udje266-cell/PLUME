-- Tomes (volumes) : regroupement OPTIONNEL de chapitres au sein d'une oeuvre.
-- Purement additif : aucune donnee existante n'est modifiee, les chapitres
-- actuels gardent tomeId = NULL et se lisent comme avant.

CREATE TABLE IF NOT EXISTS "Tome" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tome_storyId_order_key" ON "Tome"("storyId", "order");
CREATE INDEX IF NOT EXISTS "Tome_storyId_idx" ON "Tome"("storyId");

ALTER TABLE "Tome" ADD CONSTRAINT "Tome_storyId_fkey"
    FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lien optionnel chapitre -> tome (NULL par defaut).
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "tomeId" TEXT;
CREATE INDEX IF NOT EXISTS "Chapter_tomeId_idx" ON "Chapter"("tomeId");

ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_tomeId_fkey"
    FOREIGN KEY ("tomeId") REFERENCES "Tome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
