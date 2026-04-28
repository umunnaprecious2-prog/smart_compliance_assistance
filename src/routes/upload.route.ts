import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { extractTextFromPDF } from '../utils/file.helper.ts';
import { processAndSaveChunks } from '../services/documentChunk.service.ts';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log('File received:', req.file.originalname);

    let rawText: string;
    let chunks: string[];

    try {
      rawText = await extractTextFromPDF(req.file.path);

      const chunkSize = 1000;
      chunks = [];
      for (let i = 0; i < rawText.length; i += chunkSize) {
        chunks.push(rawText.substring(i, i + chunkSize));
      }

      console.log(`Created ${chunks.length} chunks from the PDF.`);
    } catch (extractionError) {
      console.error('Extraction Error:', extractionError);
      return res.status(500).json({ error: 'Failed to extract text from PDF' });
    }

    try {
      const savedChunks = await processAndSaveChunks(chunks, req.file.originalname);
      console.log(`✅ Success: ${savedChunks.count} chunks saved to PostgreSQL.`);

      res.status(200).json({
        message: 'File uploaded, processed, and saved successfully',
        charCount: rawText.length,
        totalChunks: chunks.length,
        savedChunks: savedChunks.count,
        snippet: rawText.substring(0, 100) + "..."
      });
    } catch (dbError) {
      console.error('Database Persistence Error:', dbError);
      return res.status(500).json({ error: 'Failed to save chunks to the database' });
    }

  } finally {
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(e => console.error('Cleanup Error:', e));
    }
  }
});

export default router;
