-- Genres principaux MULTIPLES par œuvre (JSON array). Champ additif : les œuvres
-- existantes demarrent avec [] (le genre unique historique reste dans `genre`).
-- Idempotent.
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "genres" TEXT NOT NULL DEFAULT '[]';
