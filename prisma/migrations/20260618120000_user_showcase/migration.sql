-- Vitrine de trophees mis en avant sur le profil (snapshots {id,title}).
ALTER TABLE "User" ADD COLUMN "showcase" JSONB;
