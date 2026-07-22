-- Trophees legendaires/secrets debloques : map JSON { trophyId: dateISO }.
-- Champ additif, nullable. Les CONDITIONS d'obtention ne sont jamais stockees
-- ici : seulement le fait qu'un trophee est acquis et sa date. Idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legendaryUnlocks" JSONB;
