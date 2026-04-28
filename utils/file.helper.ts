import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export async function extractText(filePath: string): Promise<string> {
  const dataBuffer = await fs.promises.readFile(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  return data.text;
}

export function createChunks(text: string, size: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];

  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }
  if (overlap < 0 || overlap >= size) {
    throw new Error('Chunk overlap must be greater than or equal to 0 and less than chunk size');
  }

  const step = size - overlap;

  for (let i = 0; i < text.length; i += step) {
    const chunk = text.substring(i, i + size).trim();
    chunks.push(chunk);
  }

  return chunks.filter(c => c.length > 0);
}
