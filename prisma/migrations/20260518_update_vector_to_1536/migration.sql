-- AlterTable: Add new column for 1536 dimensions, keep old for data safety
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding_new" vector(1536);
-- Note: Existing data in 'embedding' (768) is preserved. Application logic should be updated to read from 'embedding_new' once re-generated, then 'embedding' can be dropped in a future migration.
