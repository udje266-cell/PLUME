-- Preference d'affichage du sexe sur le profil public. Champ additif avec valeur
-- par defaut (visible). Idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showGender" BOOLEAN NOT NULL DEFAULT true;
