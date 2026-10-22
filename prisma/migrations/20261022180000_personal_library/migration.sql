CREATE TABLE "BookCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookCollection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CollectionBook" (
    "collectionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionBook_pkey" PRIMARY KEY ("collectionId","storyId")
);
CREATE UNIQUE INDEX "BookCollection_userId_name_key" ON "BookCollection"("userId", "name");
CREATE INDEX "CollectionBook_storyId_idx" ON "CollectionBook"("storyId");
ALTER TABLE "BookCollection" ADD CONSTRAINT "BookCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionBook" ADD CONSTRAINT "CollectionBook_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BookCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionBook" ADD CONSTRAINT "CollectionBook_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
