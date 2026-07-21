-- Connexion Google : identifiant Google (claim `sub`) pour lier un compte.
-- Champ additif, nullable et unique. Idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
