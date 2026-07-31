-- CreateTable
CREATE TABLE "PokeArenaSave" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokeArenaSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokeArenaSave_streamerId_key" ON "PokeArenaSave"("streamerId");
