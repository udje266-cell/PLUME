-- Réponse / édition / suppression globale des messages.
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedForEveryone" BOOLEAN NOT NULL DEFAULT false;
