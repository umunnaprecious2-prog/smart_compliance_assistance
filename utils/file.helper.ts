import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export async function extractText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  return data.text;
}

export function createChunks(text: string, size: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += (size - overlap)) {
    const chunk = text.substring(i, i + size).trim();
    chunks.push(chunk);
  }

  return chunks.filter(c => c.length > 0);
}
