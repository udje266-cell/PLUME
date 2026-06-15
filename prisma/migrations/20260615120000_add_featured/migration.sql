-- Mise en avant par l'administrateur (visibilité accrue).
ALTER TABLE "Story" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
