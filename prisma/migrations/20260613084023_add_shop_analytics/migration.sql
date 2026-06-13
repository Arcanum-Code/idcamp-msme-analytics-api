-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('UPLOADED', 'DETECTING_COLUMNS', 'NEEDS_MAPPING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawUpload" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "columnMap" JSONB,
    "unmappedRequired" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rowCount" INTEGER,
    "error" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "RawUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PROCESSING',
    "revenueData" JSONB,
    "narrative" TEXT,
    "error" JSONB,
    "computedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shop_ownerId_idx" ON "Shop"("ownerId");

-- CreateIndex
CREATE INDEX "RawUpload_shopId_idx" ON "RawUpload"("shopId");

-- CreateIndex
CREATE INDEX "ReportSnapshot_shopId_idx" ON "ReportSnapshot"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSnapshot_uploadId_periodType_periodStart_periodEnd_key" ON "ReportSnapshot"("uploadId", "periodType", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawUpload" ADD CONSTRAINT "RawUpload_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "RawUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
