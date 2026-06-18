-- Réponse / édition / suppression pour tout le monde sur les messages de groupe
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "deletedForEveryone" BOOLEAN NOT NULL DEFAULT false;
