-- AlterTable
-- 1. Conversion du type de la colonne de Gender (enum) vers VARCHAR(255)
ALTER TABLE "User" ALTER COLUMN "gender" TYPE VARCHAR(255) USING "gender"::text;

-- 2. Normalisation des données existantes vers le format mixte
UPDATE "User" SET "gender" = 'Homme' WHERE "gender" = 'HOMME';
UPDATE "User" SET "gender" = 'Femme' WHERE "gender" = 'FEMME';

-- 3. Suppression du type Enum devenu inutile
DROP TYPE "Gender";
