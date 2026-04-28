import { prisma } from '../lib/prisma.js';
import { generateEmbedding } from '../utils/ai.helper.js';

export const processAndSaveChunks = async (chunks: string[], sourceName?: string) => {
  const dataToSave = await Promise.all(
    chunks.map(async (content) => {
      const vector = await generateEmbedding(content);

      return {
        content,
        embedding: vector,
        metadata: {
          source: sourceName ?? null,
          task: "2.4",
          createdAt: new Date()
        },
      };
    })
  );

  return await prisma.documentChunk.createMany({
    data: dataToSave,
  });
};
