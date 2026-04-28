import { prisma } from '../lib/prisma.ts';
import { generateEmbedding } from '../utils/ai.helper.ts';

export const semanticSearch = async (query: string, limit = 5) => {
  const queryVector = await generateEmbedding(query);
  const vectorString = `[${queryVector.join(',')}]`;

  const results = await prisma.$queryRaw`
    SELECT id, content, metadata, 
    (embedding <=> ${vectorString}::vector) as distance
    FROM "DocumentChunk"
    ORDER BY distance ASC
    LIMIT ${limit};
  `;

  return results;
};
