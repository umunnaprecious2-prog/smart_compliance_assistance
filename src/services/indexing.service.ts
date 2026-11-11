import { prisma } from '../lib/prisma.ts';
import { generateEmbedding } from '../utils/ai.helper.ts';


interface IndexingProgress {
  total: number;
  processed: number;
  failed: number;
  completed: boolean;
}

export const indexAllDocuments = async (): Promise<IndexingProgress> => {
  const chunksToIndex = await prisma.documentChunk.findMany({
    where: { embeddingGenerated: false } as any,
    select: { id: true, content: true },
    take: 50,
  });

  if (chunksToIndex.length === 0) {
    return {
      total: 0,
      processed: 0,
      failed: 0,
      completed: true,
    };
  }

  let processed = 0;
  let failed = 0;

  for (const chunk of chunksToIndex) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      const embeddingStr = `[${embedding.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${embeddingStr}::vector, "embeddingGenerated" = true
        WHERE id = ${chunk.id}
      `;

      processed++;
    } catch (error) {
      console.error(`Failed to index chunk ${chunk.id}:`, error);
      failed++;
    }
  }

  return {
    total: chunksToIndex.length,
    processed,
    failed,
    completed: chunksToIndex.length < 50,
  };
};

export const getIndexingStatus = async (): Promise<{
  unindexedCount: number;
  indexedCount: number;
  totalCount: number;
  indexingPercentage: number;
}> => {
  const totalCount = await prisma.documentChunk.count();
  const indexedCount = await prisma.documentChunk.count({
    where: { embeddingGenerated: true } as any,
  });
  const unindexedCount = totalCount - indexedCount;

  return {
    totalCount,
    indexedCount,
    unindexedCount,
    indexingPercentage: totalCount > 0 ? Math.round((indexedCount / totalCount) * 100) : 0,
  };
};
