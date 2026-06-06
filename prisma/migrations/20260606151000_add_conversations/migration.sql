-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserConversations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserConversations_AB_unique" ON "_UserConversations"("A", "B");

-- CreateIndex
CREATE INDEX "_UserConversations_B_index" ON "_UserConversations"("B");

-- AddForeignKey
ALTER TABLE "_UserConversations" ADD CONSTRAINT "_UserConversations_A_fkey" FOREIGN KEY ("A") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserConversations" ADD CONSTRAINT "_UserConversations_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

-- MigrateData
DO $$
DECLARE
    r RECORD;
    c_id TEXT;
BEGIN
    FOR r IN 
        SELECT DISTINCT 
            LEAST("senderId", "receiverId") as u1, 
            GREATEST("senderId", "receiverId") as u2 
        FROM "Message"
    LOOP
        c_id := 'conv_' || md5(r.u1 || '_' || r.u2);
        
        INSERT INTO "Conversation" ("id", "createdAt", "updatedAt")
        VALUES (c_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING;
        
        INSERT INTO "_UserConversations" ("A", "B")
        VALUES (c_id, r.u1)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO "_UserConversations" ("A", "B")
        VALUES (c_id, r.u2)
        ON CONFLICT DO NOTHING;
        
        UPDATE "Message"
        SET "conversationId" = c_id
        WHERE ("senderId" = r.u1 AND "receiverId" = r.u2)
           OR ("senderId" = r.u2 AND "receiverId" = r.u1);
    END LOOP;
END $$;

-- AlterColumn
ALTER TABLE "Message" ALTER COLUMN "conversationId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Message_receiverId_idx";

-- DropColumn
ALTER TABLE "Message" DROP COLUMN "receiverId";

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
