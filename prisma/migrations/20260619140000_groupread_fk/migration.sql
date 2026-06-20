-- Integrite : GroupRead n'avait AUCUNE cle etrangere -> lignes orphelines a chaque
-- suppression d'utilisateur/groupe. On purge d'abord les orphelins (sinon l'ajout
-- de contrainte echoue), puis on ajoute les FK en cascade + un index sur userId.
DELETE FROM "GroupRead" gr
WHERE NOT EXISTS (SELECT 1 FROM "ReadingGroup" g WHERE g."id" = gr."groupId")
   OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = gr."userId");

CREATE INDEX IF NOT EXISTS "GroupRead_userId_idx" ON "GroupRead"("userId");

ALTER TABLE "GroupRead"
  ADD CONSTRAINT "GroupRead_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReadingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRead"
  ADD CONSTRAINT "GroupRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
