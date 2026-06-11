-- Dates des dernières modifications soumises à un délai (anti-abus).
ALTER TABLE "User" ADD COLUMN "usernameChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailChangedAt" TIMESTAMP(3);
