-- ChapterRead : cles etrangeres en cascade vers Story et Chapter.
-- Avant : seul userId avait une FK ; supprimer un chapitre ou une oeuvre
-- laissait des lignes ChapterRead orphelines (stats gonflees a jamais).
-- Migration additive et idempotente : on purge d'abord les orphelins
-- existants (sinon l'ajout des FK echouerait), puis on ajoute les
-- contraintes si elles n'existent pas deja.

-- 1) Purge des orphelins existants
DELETE FROM "ChapterRead" cr
WHERE NOT EXISTS (SELECT 1 FROM "Chapter" c WHERE c."id" = cr."chapterId")
   OR NOT EXISTS (SELECT 1 FROM "Story" s WHERE s."id" = cr."storyId");

-- 2) Index sur storyId (requetes de stats auteur groupees par oeuvre)
CREATE INDEX IF NOT EXISTS "ChapterRead_storyId_idx" ON "ChapterRead"("storyId");

-- 3) FK vers Story (cascade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterRead_storyId_fkey'
  ) THEN
    ALTER TABLE "ChapterRead"
      ADD CONSTRAINT "ChapterRead_storyId_fkey"
      FOREIGN KEY ("storyId") REFERENCES "Story"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) FK vers Chapter (cascade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterRead_chapterId_fkey'
  ) THEN
    ALTER TABLE "ChapterRead"
      ADD CONSTRAINT "ChapterRead_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
