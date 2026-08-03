-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "telegramId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "duration" INTEGER,
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "coverPath" TEXT,
    "channelId" TEXT NOT NULL,
    "telegramMessageId" BIGINT NOT NULL,
    "telegramFileId" BIGINT,
    "telegramFileUniqueId" TEXT NOT NULL,
    "telegramAccessHash" TEXT,
    "slug" TEXT NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "lastMessageId" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_telegramId_key" ON "Channel"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Track_telegramFileUniqueId_key" ON "Track"("telegramFileUniqueId");

-- CreateIndex
CREATE INDEX "Track_channelId_createdAt_idx" ON "Track"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Track_title_idx" ON "Track"("title");

-- CreateIndex
CREATE INDEX "Track_artist_idx" ON "Track"("artist");

-- CreateIndex
CREATE UNIQUE INDEX "Track_channelId_telegramMessageId_key" ON "Track"("channelId", "telegramMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_channelId_key" ON "SyncCursor"("channelId");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
