-- Convertit les colonnes encore typées en enum PostgreSQL vers VARCHAR, afin
-- de les aligner sur le schéma Prisma (qui les déclare en String). Sans cela,
-- l'insertion/lecture de valeurs comme 'FOLLOW' ou 'MESSAGE' échoue avec
-- « Error converting field ... expected String, found incompatible value ... ».

-- Story.status : StoryStatus (enum) -> VARCHAR
ALTER TABLE "Story" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Story" ALTER COLUMN "status" TYPE VARCHAR(255) USING "status"::text;
ALTER TABLE "Story" ALTER COLUMN "status" SET DEFAULT 'BROUILLON';

-- Story.ageRating : AgeRating (enum) -> VARCHAR
ALTER TABLE "Story" ALTER COLUMN "ageRating" DROP DEFAULT;
ALTER TABLE "Story" ALTER COLUMN "ageRating" TYPE VARCHAR(255) USING "ageRating"::text;
ALTER TABLE "Story" ALTER COLUMN "ageRating" SET DEFAULT 'ALL';

-- Friendship.status : FriendshipStatus (enum) -> VARCHAR
ALTER TABLE "Friendship" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Friendship" ALTER COLUMN "status" TYPE VARCHAR(255) USING "status"::text;
ALTER TABLE "Friendship" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Notification.type : NotificationType (enum) -> VARCHAR (NOT NULL, sans défaut)
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE VARCHAR(255) USING "type"::text;

-- Suppression des types enum devenus inutiles
DROP TYPE "StoryStatus";
DROP TYPE "AgeRating";
DROP TYPE "FriendshipStatus";
DROP TYPE "NotificationType";
