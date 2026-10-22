-- Commentaire ancré sur un paragraphe (facultatif). Additif, idempotent.
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "paragraphIndex" INTEGER;
