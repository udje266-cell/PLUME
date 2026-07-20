-- Demandes de message (facon TikTok) : entre deux personnes NON amies,
-- l'initiateur ne peut envoyer que quelques messages tant que le destinataire
-- n'a pas accepte. Champs additifs sur Conversation, idempotents.

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "requestStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "requesterId" TEXT;
