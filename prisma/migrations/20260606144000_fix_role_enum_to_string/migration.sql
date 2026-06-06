-- AlterTable
-- 1. Suppression de la valeur par défaut existante
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- 2. Conversion du type de la colonne de UserRole (enum) vers VARCHAR(255)
ALTER TABLE "User" ALTER COLUMN "role" TYPE VARCHAR(255) USING "role"::text;

-- 3. Normalisation des données existantes vers le format mixte attendu
UPDATE "User" SET "role" = 'Lecteur' WHERE "role" = 'LECTEUR' OR "role" IS NULL;
UPDATE "User" SET "role" = 'Auteur' WHERE "role" = 'AUTEUR';
UPDATE "User" SET "role" = 'Utilisateur Mixte' WHERE "role" = 'UTILISATEUR_MIXTE';
UPDATE "User" SET "role" = 'Administrateur' WHERE "role" = 'ADMINISTRATEUR';

-- 4. Ajout de la nouvelle valeur par défaut normalisée
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'Lecteur';

-- 5. Suppression du type Enum devenu inutile
DROP TYPE "UserRole";
