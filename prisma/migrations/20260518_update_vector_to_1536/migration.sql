-- AlterTable: Change embedding column from vector(768) to vector(1536)
ALTER TABLE "DocumentChunk" ALTER COLUMN embedding TYPE vector(1536);
