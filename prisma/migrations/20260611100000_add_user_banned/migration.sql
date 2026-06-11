-- Suspension de compte par un administrateur (bloque la connexion, réversible).
ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;
