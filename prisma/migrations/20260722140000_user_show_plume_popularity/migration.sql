-- Preference d'affichage de la popularite Plume (badge de niveau auteur) sur le
-- profil public. Champ additif avec valeur par defaut. Idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showPlumePopularity" BOOLEAN NOT NULL DEFAULT true;
