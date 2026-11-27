const CHUNK_TARGET_SIZE = 1000;
const CHUNK_MAX_SIZE = 1500;
const OVERLAP_SIZE = 200;
const MAX_PARAGRAPH_SIZE = 3000;

function splitIntoSentences(text: string): string[] {
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$/g;
  
  return text
    .split(sentenceRegex)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

export function semanticChunk(text: string, targetSize = CHUNK_TARGET_SIZE): string[] {
  if (text.length < targetSize) {
    return [text];
  }

  const paragraphs = splitIntoParagraphs(text);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (para.length > MAX_PARAGRAPH_SIZE) {
      const sentences = splitIntoSentences(para);
      
      for (const sentence of sentences) {
        const testChunk = currentChunk ? `${currentChunk}\n\n${sentence}` : sentence;
        
        if (testChunk.length <= CHUNK_MAX_SIZE) {
          currentChunk = testChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = sentence.length <= OVERLAP_SIZE 
              ? sentence 
              : sentence.substring(0, OVERLAP_SIZE);
          } else {
            chunks.push(sentence);
            currentChunk = sentence.length <= OVERLAP_SIZE 
              ? sentence 
              : sentence.substring(0, OVERLAP_SIZE);
          }
        }
      }
    } else {
      const testChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
      
      if (testChunk.length <= CHUNK_MAX_SIZE) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = para.length <= OVERLAP_SIZE 
            ? para 
            : para.substring(0, OVERLAP_SIZE);
        } else {
          chunks.push(para);
          currentChunk = para.length <= OVERLAP_SIZE 
            ? para 
            : para.substring(0, OVERLAP_SIZE);
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(c => c.length > 0);
}

export interface ChunkingResult {
  chunks: string[];
  totalChunks: number;
  avgChunkSize: number;
  compressionRatio: number;
}

export function semanticChunkWithMetrics(text: string): ChunkingResult {
  const chunks = semanticChunk(text);
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const avgChunkSize = chunks.length > 0 ? Math.round(totalSize / chunks.length) : 0;
  const compressionRatio = chunks.length > 0 ? Math.round((text.length / chunks.length) * 100) / 100 : 0;

  return {
    chunks,
    totalChunks: chunks.length,
    avgChunkSize,
    compressionRatio,
  };
}
