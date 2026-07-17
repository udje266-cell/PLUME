-- Mode d'organisation d'une oeuvre : "chapters" (defaut, comportement
-- historique) ou "tomes". Purement additif : les oeuvres existantes prennent
-- "chapters" et se comportent exactement comme avant.
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "structure" TEXT NOT NULL DEFAULT 'chapters';
