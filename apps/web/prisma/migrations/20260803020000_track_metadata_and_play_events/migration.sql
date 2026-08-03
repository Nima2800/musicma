-- AlterTable
ALTER TABLE "Track" ADD COLUMN "album" TEXT;
ALTER TABLE "Track" ADD COLUMN "caption" TEXT;
ALTER TABLE "Track" ADD COLUMN "genre" TEXT;
ALTER TABLE "Track" ADD COLUMN "mood" TEXT;
ALTER TABLE "Track" ADD COLUMN "year" INTEGER;
ALTER TABLE "Track" ADD COLUMN "language" TEXT;
ALTER TABLE "Track" ADD COLUMN "isRemix" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Track" ADD COLUMN "isInstrumental" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Track" ADD COLUMN "bitrate" INTEGER;
ALTER TABLE "Track" ADD COLUMN "quality" TEXT;
ALTER TABLE "Track" ADD COLUMN "waveformPeaks" JSONB;
ALTER TABLE "Track" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "Track" ADD COLUMN "telegramPostUrl" TEXT;
ALTER TABLE "Track" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Track" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Track" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Track" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN "saveCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Track" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayEvent" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Track_playCount_idx" ON "Track"("playCount");

-- CreateIndex
CREATE INDEX "Track_publishedAt_idx" ON "Track"("publishedAt");

-- CreateIndex
CREATE INDEX "Track_mood_idx" ON "Track"("mood");

-- CreateIndex
CREATE INDEX "Track_genre_idx" ON "Track"("genre");

-- CreateIndex
CREATE INDEX "Track_isFeatured_idx" ON "Track"("isFeatured");

-- CreateIndex
CREATE INDEX "Track_isPublished_isAvailable_idx" ON "Track"("isPublished", "isAvailable");

-- CreateIndex
CREATE INDEX "PlayEvent_createdAt_idx" ON "PlayEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PlayEvent_trackId_createdAt_idx" ON "PlayEvent"("trackId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayEvent" ADD CONSTRAINT "PlayEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
