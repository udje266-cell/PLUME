-- CreateTable
CREATE TABLE "StoryRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryRating_storyId_idx" ON "StoryRating"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryRating_userId_storyId_key" ON "StoryRating"("userId", "storyId");

-- AddForeignKey
ALTER TABLE "StoryRating" ADD CONSTRAINT "StoryRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryRating" ADD CONSTRAINT "StoryRating_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
