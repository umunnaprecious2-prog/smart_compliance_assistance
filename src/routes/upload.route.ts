import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { extractTextFromPDF } from '../utils/file.helper.ts';
import { semanticChunkWithMetrics } from '../utils/chunking.helper.ts';
import { processAndSaveChunks } from '../services/documentChunk.service.ts';
import { prisma } from '../lib/prisma.ts';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', async (req, res) => {
  const result = await prisma.document.findMany();
  res.json(result);
});

router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log('File received:', req.file.originalname);

    let extraction: Awaited<ReturnType<typeof extractTextFromPDF>>;
    let chunkingMetrics: Awaited<ReturnType<typeof semanticChunkWithMetrics>>;

    try {
      extraction = await extractTextFromPDF(req.file.path);

      chunkingMetrics = semanticChunkWithMetrics(extraction.text);

      console.log(
        `[Upload] Extracted via "${extraction.strategy}" — ${chunkingMetrics.totalChunks} semantic chunks ` +
        `(avg ${chunkingMetrics.avgChunkSize}B, ratio ${chunkingMetrics.compressionRatio})` +
        (extraction.pageCount ? `, ${extraction.pageCount} pages` : '')
      );
    } catch (extractionError) {
      console.error('Extraction Error:', extractionError);
      return res.status(422).json({
        error: 'Failed to extract text from PDF',
        detail: (extractionError as any).message,
      });
    }

    try {
      const savedDoc = await processAndSaveChunks(chunkingMetrics.chunks, req.file.originalname);
      console.log(`[Database] ${savedDoc.chunks.length} semantic chunks saved to PostgreSQL.`);

      res.status(200).json({
        message: 'File processed and saved successfully',
        documentId: savedDoc.id,
        chunksCount: chunkingMetrics.totalChunks,
        pageCount: extraction.pageCount ?? null,
        extractionStrategy: extraction.strategy,
        chunkingStrategy: 'semantic-paragraph-aware',
        avgChunkSize: chunkingMetrics.avgChunkSize,
      });
    } catch (dbError) {
      console.error('Database Persistence Error:', dbError);
      return res.status(500).json({ error: 'Failed to save chunks to the database' });
    }

  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(e => console.error('Cleanup Error:', e));
    }
  }
});

export default router;
