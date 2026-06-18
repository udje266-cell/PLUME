-- Accuses de lecture par membre dans les groupes
CREATE TABLE IF NOT EXISTS "GroupRead" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastRead" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupRead_groupId_userId_key" ON "GroupRead"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "GroupRead_groupId_idx" ON "GroupRead"("groupId");
