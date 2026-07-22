-- Optimisations ADDITIVES et non cassantes : index composites pour les chemins
-- de requetes chauds + vraie cle etrangere DeviceToken -> User. Tout est
-- idempotent (IF NOT EXISTS / garde d'exception) pour un deploiement sans risque.

-- Index composites (les index simples existants sont conserves).
CREATE INDEX IF NOT EXISTS "Story_status_createdAt_idx" ON "Story"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_chapterId_createdAt_idx" ON "Comment"("chapterId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
CREATE INDEX IF NOT EXISTS "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- DeviceToken : vraie FK vers User (cascade). On purge d'abord les eventuels
-- orphelins (jetons dont l'utilisateur n'existe plus) pour que l'ajout de la
-- contrainte ne puisse pas echouer, puis on ajoute la FK si elle est absente.
DELETE FROM "DeviceToken" WHERE "userId" NOT IN (SELECT "id" FROM "User");

DO $$ BEGIN
  ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
