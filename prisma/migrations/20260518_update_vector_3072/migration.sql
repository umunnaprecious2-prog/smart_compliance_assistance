-- Clear existing embeddings
UPDATE "DocumentChunk" SET embedding = NULL;

-- AlterTable
ALTER TABLE "DocumentChunk" ALTER COLUMN embedding TYPE vector(3072);
