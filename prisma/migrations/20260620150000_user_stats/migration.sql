-- Statistiques de progression des succes (UserStats) persistees serveur.
ALTER TABLE "User" ADD COLUMN "stats" JSONB;
