import pdf from 'pdf-parse';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODELS } from '../config/models.ts';

export interface ExtractionResult {
  text: string;
  strategy: 'pdf-parse' | 'pdfjs' | 'gemini-ocr';
  pageCount?: number;
}

const MIN_MEANINGFUL_LENGTH = 10;

function normalizeText(raw: string): string {
  return raw
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2009/g, ' ')
    .replace(/[\u2000-\u200A]/g, ' ')
    .replace(/[\u2002\u2003\u3000]/g, ' ')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/ﬅ|ﬆ/g, 'st')
    .replace(/\u0132/g, 'IJ')
    .replace(/\u0133/g, 'ij')
    .replace(/[\u2018\u2019\u02BC\u0060]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2010/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/(\w)\n(\w)/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function isMeaningful(text: string): boolean {
  return text.length >= MIN_MEANINGFUL_LENGTH;
}

async function extractWithPdfParse(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const data = await pdf(buffer);
  return { text: data.text, pageCount: data.numpages };
}

async function extractWithPdfJs(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      constructor() { }
      static fromFloat32Array() { return new DOMMatrix(); }
      static fromFloat64Array() { return new DOMMatrix(); }
    };
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return { text: pages.join('\n\n'), pageCount };
}

async function extractWithGeminiOCR(buffer: Buffer): Promise<{ text: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key configured for OCR fallback');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODELS.GENERATIVE });

  const base64Data = buffer.toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data,
      },
    },
    `Extract all content from this document with high fidelity. 
     - For TABLES: Convert them into valid Markdown table format.
     - For CHARTS/GRAPHS: Describe the data points and trends in detail.
     - For HEADINGS: Preserve the hierarchy.
     - TEXT: Extract all text exactly as written.
     
     Return the content in a clean, structured format. Do not add any conversational filler.`,
  ]);

  const text = result.response.text();
  if (!text || text.length < 10) {
    throw new Error('Gemini OCR returned empty or insufficient content');
  }

  return { text };
}

export const extractTextFromPDF = async (filePath: string): Promise<ExtractionResult> => {
  const buffer = await fs.readFile(filePath);
  console.log(`[Extraction] Starting extraction for: ${filePath} (${buffer.length} bytes)`);

  try {
    const { text, pageCount } = await extractWithPdfParse(buffer);
    const cleaned = normalizeText(text);
    console.log(`[Extraction] 1. pdf-parse found ${cleaned.length} characters across ${pageCount} pages`);

    if (isMeaningful(cleaned)) {
      return { text: cleaned, strategy: 'pdf-parse', pageCount };
    }
  } catch (err) {
    console.warn('[Extraction] [pdf-parse error]:', (err as any).message);
  }

  try {
    const { text, pageCount } = await extractWithPdfJs(buffer);
    const cleaned = normalizeText(text);
    console.log(`[Extraction] 2. pdfjs-dist found ${cleaned.length} characters across ${pageCount} pages`);

    if (isMeaningful(cleaned)) {
      return { text: cleaned, strategy: 'pdfjs', pageCount };
    }
  } catch (err) {
    console.warn('[Extraction] [pdfjs-dist error]:', (err as any).message);
  }

  console.log('[Extraction] No text layer found or text too short. Attempting AI Vision OCR...');
  try {
    const { text } = await extractWithGeminiOCR(buffer);
    const cleaned = normalizeText(text);
    console.log(`[Extraction] 3. Gemini OCR found ${cleaned.length} characters`);

    if (isMeaningful(cleaned)) {
      return { text: cleaned, strategy: 'gemini-ocr' };
    }
  } catch (err) {
    console.error('[Extraction] [Gemini OCR error]:', (err as any).message);
  }

  throw new Error(
    'All extraction strategies exhausted. The document may be corrupted, password-protected, or contain no readable text.'
  );
};
