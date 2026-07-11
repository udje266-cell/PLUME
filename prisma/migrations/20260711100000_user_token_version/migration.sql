-- Révocation de sessions : version de token par utilisateur. Incrémentée au
-- reset/changement de mot de passe et au bannissement, elle invalide
-- immédiatement tous les JWT émis avant (qui embarquent l'ancienne version).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
