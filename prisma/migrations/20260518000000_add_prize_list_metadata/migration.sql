-- AlterTable
ALTER TABLE "PrizeList" ADD COLUMN "description" TEXT;
ALTER TABLE "PrizeList" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "PrizeList" ADD COLUMN "coverUrl" TEXT;
