-- Parametres de groupe (style WhatsApp) + invitation.
ALTER TABLE "ReadingGroup" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "ReadingGroup" ADD COLUMN "whoCanEditInfo" TEXT NOT NULL DEFAULT 'admins';
ALTER TABLE "ReadingGroup" ADD COLUMN "messagePermission" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "ReadingGroup" ADD COLUMN "allowReactions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReadingGroup" ADD COLUMN "allowMedia" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReadingGroup" ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReadingGroup" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "ReadingGroup" ADD COLUMN "inviteEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "ReadingGroup_inviteCode_key" ON "ReadingGroup"("inviteCode");

-- Moderation / mise en avant des messages.
ALTER TABLE "GroupMessage" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupMessage" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "GroupMessage" ADD COLUMN "isAnnouncement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupMessage" ADD COLUMN "deletedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Adhesions (role + statut + date d'entree).
CREATE TABLE "GroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId","userId");
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReadingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reactions aux messages de groupe.
CREATE TABLE "GroupMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMessageReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupMessageReaction_messageId_userId_emoji_key" ON "GroupMessageReaction"("messageId","userId","emoji");
CREATE INDEX "GroupMessageReaction_messageId_idx" ON "GroupMessageReaction"("messageId");
ALTER TABLE "GroupMessageReaction" ADD CONSTRAINT "GroupMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GroupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMessageReaction" ADD CONSTRAINT "GroupMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : on materialise les adhesions existantes (table m2m implicite
-- "_GroupMembers" : "A" = ReadingGroup.id, "B" = User.id). Le createur devient
-- proprietaire (owner), les autres membres simples (member).
INSERT INTO "GroupMember" ("id","groupId","userId","role","status","joinedAt")
SELECT md5(gm."A" || gm."B" || random()::text), gm."A", gm."B",
  CASE WHEN rg."creatorId" = gm."B" THEN 'owner' ELSE 'member' END,
  'active', rg."createdAt"
FROM "_GroupMembers" gm
JOIN "ReadingGroup" rg ON rg."id" = gm."A"
ON CONFLICT ("groupId","userId") DO NOTHING;
