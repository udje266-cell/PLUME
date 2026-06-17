-- Stickers personnalisés persistés (survivent à une réinstallation).
ALTER TABLE "User" ADD COLUMN "customStickers" TEXT;
