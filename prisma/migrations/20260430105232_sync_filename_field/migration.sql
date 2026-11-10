/*
  Warnings:

  - Added the required column `filename` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentId` to the `DocumentChunk` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "filename" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "documentId" INTEGER;

-- Update existing rows to link to a dummy document or handle appropriately
-- Note: This assumes a migration strategy where we allow nulls temporarily or provide a valid default.
-- Since we cannot guarantee a valid ID, we set a placeholder and expect the application to handle data integrity.
UPDATE "DocumentChunk" SET "documentId" = (SELECT "id" FROM "Document" LIMIT 1) WHERE "documentId" IS NULL;

-- AlterTable
ALTER TABLE "DocumentChunk" ALTER COLUMN "documentId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
