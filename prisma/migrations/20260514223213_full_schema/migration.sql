/*
  Warnings:

  - Added the required column `passwordHash` to the `Streamer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Streamer" ADD COLUMN     "audioEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "eventEffect" TEXT NOT NULL DEFAULT 'confetti',
ADD COLUMN     "eventMusic" TEXT NOT NULL DEFAULT 'cyberpunk',
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kickChannel" TEXT,
ADD COLUMN     "kickChatroomId" INTEGER,
ADD COLUMN     "mascot" TEXT NOT NULL DEFAULT 'careca',
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "pscBalance" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "twitchChannel" DROP NOT NULL,
ALTER COLUMN "twitchChannel" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RaffleHistory" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "winnerNumber" INTEGER NOT NULL,
    "winnerName" TEXT NOT NULL,
    "winnerSource" TEXT,
    "prizeName" TEXT NOT NULL,
    "prizeDescription" TEXT,
    "prizeImageUrl" TEXT,
    "prizeQuantity" INTEGER NOT NULL,
    "prizePscValue" INTEGER,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RaffleHistory" ADD CONSTRAINT "RaffleHistory_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
