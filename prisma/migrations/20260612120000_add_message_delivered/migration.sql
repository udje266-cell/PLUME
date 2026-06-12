-- Accusé de distribution des messages (plume blanche x2 « remis »).
ALTER TABLE "Message" ADD COLUMN "isDelivered" BOOLEAN NOT NULL DEFAULT false;
