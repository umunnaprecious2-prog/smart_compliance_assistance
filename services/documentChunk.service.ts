import { prisma } from '../lib/prisma';

export async function saveDocumentChunks(chunks: string[], sourceName?: string) {
  const savedChunks = await prisma.documentChunk.createMany({
    data: chunks.map((content) => ({
      content: content,
      metadata: {
        source: sourceName,
        task: "2.4",
        createdAt: new Date()
      },
    })),
  });

  return savedChunks;
}
