-- Système de niveaux (XP) : jauges lecteur/auteur + métadonnées anti-abus.
ALTER TABLE "User" ADD COLUMN "readerXp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "authorXp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "xpMeta" JSONB;
-- Confidentialité : possibilité de masquer son palmarès / ses niveaux.
ALTER TABLE "User" ADD COLUMN "showPalmares" BOOLEAN NOT NULL DEFAULT true;
