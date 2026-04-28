-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);
