-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "isValidated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Channel" ADD COLUMN "autoSync" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
