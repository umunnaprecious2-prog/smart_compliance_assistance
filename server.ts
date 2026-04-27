import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const app = express();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });
const port = 3000;

// Configure storage for uploads 
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Helper function to extract text  
async function extractText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  return data.text;
}

// Splitting text into manageable pieces
function createChunks(text: string, size: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];

  // Slide through the text using the overlap to maintain context
  for (let i = 0; i < text.length; i += (size - overlap)) {
    const chunk = text.substring(i, i + size).trim();
    chunks.push(chunk);
  }

  return chunks.filter(c => c.length > 0);
}


// The Upload & Extraction Endpoint [cite: 42, 50]
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);

    // Extract the text from the saved PDF 
    const rawText = await extractText(req.file.path);


    const chunks = createChunks(rawText);

    console.log(`Created ${chunks.length} chunks from the PDF.`);
    if (chunks.length > 0) {
      console.log('Sample Chunk 1:', chunks[0].substring(0, 200));
    }

    // Update your response to show the chunk count
    res.status(200).json({
      message: 'File processed and chunked successfully',
      totalChunks: chunks.length
    });

    // Log the first 500 characters to verify success 
    console.log('--- Extracted Text Snippet ---');
    console.log(rawText.substring(0, 500));

    res.status(200).json({
      message: 'File uploaded and text extracted successfully',
      charCount: rawText.length,
      snippet: rawText.substring(0, 100) + "..."
    });

  } catch (error) {
    console.error('Extraction Error:', error);
    res.status(500).json({ error: 'Failed to extract text from PDF' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Restart trigger

