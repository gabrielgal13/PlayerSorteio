-- CreateTable
CREATE TABLE "Streamer" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twitchChannel" TEXT NOT NULL DEFAULT '',
    "registrationCommand" TEXT NOT NULL DEFAULT '!entrar',
    "claimCommand" TEXT NOT NULL DEFAULT '!claim',
    "validationTimeout" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "Streamer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_username_key" ON "Streamer"("username");
