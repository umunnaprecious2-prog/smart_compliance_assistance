import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { extractTextFromPDF } from '../utils/file.helper.ts';
import { semanticChunkWithMetrics } from '../utils/chunking.helper.ts';
import { processAndSaveChunks } from '../services/documentChunk.service.ts';
import { prisma } from '../lib/prisma.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * /upload:
 *   get:
 *     summary: List all uploaded documents
 *     description: Retrieves a list of all documents that have been uploaded and indexed
 *     tags:
 *       - Upload
 *     responses:
 *       200:
 *         description: Array of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 *       500:
 *         description: Internal server error
 */
router.get('/', requireAuth, async (req, res) => {
  const result = await prisma.document.findMany();
  res.json(result);
});

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload and index a PDF document
 *     description: |
 *       Uploads a PDF file, extracts text, chunks the content using semantic chunking,
 *       and creates embeddings for semantic search. Processing includes PII detection and redaction.
 *     tags:
 *       - Upload
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - pdf
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload and process
 *     responses:
 *       200:
 *         description: Document uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   $ref: '#/components/schemas/Document'
 *                 chunks:
 *                   type: number
 *                   description: Number of chunks created from the document
 *                 chunking_metrics:
 *                   type: object
 *                   properties:
 *                     total_chunks:
 *                       type: number
 *                     avg_chunk_size:
 *                       type: number
 *                     embedding_time_ms:
 *                       type: number
 *       400:
 *         description: No file uploaded or invalid file format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error during processing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', requireAuth, upload.single('pdf'), async (req, res) => {
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
