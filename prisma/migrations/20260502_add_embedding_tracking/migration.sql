-- Add embeddingGenerated tracking column to DocumentChunk
ALTER TABLE "DocumentChunk" ADD COLUMN "embeddingGenerated" BOOLEAN NOT NULL DEFAULT false;
