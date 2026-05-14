import { prisma } from '../lib/prisma.ts';
import { generateEmbedding } from '../utils/ai.helper.ts';

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with', 'what', 'how', 'where', 'when', 'who', 'tell', 'me', 'about', 'can', 'you']);

const keywordSearch = async (query: string, limit = 5, documentId?: number) => {
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (keywords.length === 0) {
    return [];
  }

  const chunks = await prisma.documentChunk.findMany({
    select: { id: true, content: true, metadata: true },
    where: documentId ? { documentId } : undefined,
    take: limit * 10, // Wider initial scan
  });

  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    let score = 0;

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      score += (matches ? matches.length : 0);
    });

    // Normalize distance for keyword search (max similarity 0.5)
    // distance = 1 - (score / (score + 10)) * 0.5
    // This ensures keywords alone never look as good as a vector match
    return {
      ...chunk,
      distance: 1 - (Math.min(score / (score + 5), 1) * 0.5),
      relevanceScore: score
    };
  });

  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .filter(r => r.relevanceScore > 0)
    .slice(0, limit);
};

export const semanticSearch = async (query: string, limit = 5, documentId?: number) => {
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("API key required for search. Please configure GEMINI_API_KEY or run indexing first.");
  }

  try {
    const queryVector = await generateEmbedding(query);
    const vectorString = `[${queryVector.join(',')}]`;

    const chunksWithoutEmbeddings = await prisma.documentChunk.count({
      where: documentId ? { embeddingGenerated: false, documentId } : { embeddingGenerated: false },
    } as any);

    if (chunksWithoutEmbeddings > 0) {
      await generateMissingEmbeddings(documentId);
    }

    let results: any[];
    if (documentId) {
      results = await prisma.$queryRaw`
        SELECT id, content, metadata, "documentId",
        (embedding <=> ${vectorString}::vector) as distance
        FROM "DocumentChunk"
        WHERE embedding IS NOT NULL AND "documentId" = ${documentId}
        ORDER BY distance ASC
        LIMIT ${limit};
      `;
    } else {
      results = await prisma.$queryRaw`
        SELECT id, content, metadata, "documentId",
        (embedding <=> ${vectorString}::vector) as distance
        FROM "DocumentChunk"
        WHERE embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ${limit};
      `;
    }

    return results;
  } catch (error) {
    console.warn("Vector search failed, falling back to keyword search:", (error as any).message);
    return keywordSearch(query, limit, documentId);
  }
};

async function generateMissingEmbeddings(documentId?: number) {
  const chunksToEmbed = await prisma.documentChunk.findMany({
    where: documentId ? { embeddingGenerated: false, documentId } : { embeddingGenerated: false },
    select: { id: true, content: true },
  } as any);

  if (chunksToEmbed.length === 0) return;

  for (const chunk of chunksToEmbed) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      const embeddingStr = `[${embedding.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${embeddingStr}::vector, "embeddingGenerated" = true
        WHERE id = ${chunk.id}
      `;
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.id}:`, error);
    }
  }
}
