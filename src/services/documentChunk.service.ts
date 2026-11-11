import { prisma } from '../lib/prisma.js';
import { generateEmbedding } from '../utils/ai.helper.ts';

export const processAndSaveChunks = async (chunks: string[], sourceName: string) => {
  const dataToSave = chunks.map((content, index) => {
    return {
      content,
      metadata: {
        source: sourceName,
        page: index + 1,
        createdAt: new Date()
      },
    };
  });

  const result = await prisma.document.create({
    data: {
      filename: sourceName!,
      content: chunks.join(''),
      embedding: '',
    },
  });

  for (const chunk of dataToSave) {
    const metadataJson = JSON.stringify(chunk.metadata);

    const inserted: { id: number }[] = await prisma.$queryRaw`
      INSERT INTO "DocumentChunk" (content, metadata, "embeddingGenerated", "documentId")
      VALUES (${chunk.content}, ${metadataJson}::jsonb, false, ${result.id})
      RETURNING id
    `;

    if (inserted.length === 0) throw new Error('Failed to insert chunk');
    const chunkId = inserted[0].id;

    try {
      const embedding = await generateEmbedding(chunk.content);
      const embeddingStr = `[${embedding.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE "DocumentChunk" 
        SET embedding = ${embeddingStr}::vector, "embeddingGenerated" = true
        WHERE id = ${chunkId}
      `;
    } catch (error) {
      console.error(`Failed to generate embedding for chunk in ${sourceName}:`, (error as any).message);
    }
  }

  const updatedResult = await prisma.document.findUnique({
    where: { id: result.id },
    include: { chunks: true },
  });

  return updatedResult!;
};

export const getLatestDocument = async () => {
  return await prisma.document.findFirst({
    orderBy: { createdAt: 'desc' }
  });
};
