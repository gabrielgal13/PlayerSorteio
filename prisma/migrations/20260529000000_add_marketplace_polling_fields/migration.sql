-- AlterTable
ALTER TABLE "RaffleHistory" ADD COLUMN IF NOT EXISTS "marketplaceRetries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RaffleHistory" ADD COLUMN IF NOT EXISTS "marketplaceCheckedAt" TIMESTAMP(3);
