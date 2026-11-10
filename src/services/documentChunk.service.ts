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
    const createdChunk = await prisma.documentChunk.create({
      data: {
        content: chunk.content,
        metadata: chunk.metadata,
        embeddingGenerated: false,
        documentId: result.id
      }
    });

    try {
      const embedding = await generateEmbedding(chunk.content);

      await prisma.documentChunk.update({
        where: { id: createdChunk.id },
        data: {
          embedding: embedding,
          embeddingGenerated: true
        }
      });
    } catch (error) {
      console.error("Failed to generate embedding for chunk", (error as any).message);
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
