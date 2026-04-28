import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { extractText, createChunks } from '../utils/file.helper';
import { saveDocumentChunks } from '../services/documentChunk.service';

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
      rawText = await extractText(req.file.path);
      chunks = createChunks(rawText);
      console.log(`Created ${chunks.length} chunks from the PDF.`);
    } catch (extractionError) {
      console.error('Extraction Error:', extractionError);
      return res.status(500).json({ error: 'Failed to extract text from PDF' });
    }

    try {
      const savedChunks = await saveDocumentChunks(chunks, req.file.originalname);
      console.log(`✅ Success: ${savedChunks.count} chunks saved to PostgreSQL.`);

      res.status(200).json({
        message: 'File uploaded, extracted, and saved to database successfully',
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
      await fs.promises.unlink(req.file.path).catch(e => console.error('Failed to delete temporary file:', e));
    }
  }
});

export default router;
