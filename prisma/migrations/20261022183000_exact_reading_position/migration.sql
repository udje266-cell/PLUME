-- Keep the exact paragraph: a rounded percentage loses precision in long chapters.
-- Nullable for positions written by older Android/PWA clients.
ALTER TABLE "ReadingProgress" ADD COLUMN "paragraphIndex" INTEGER;
