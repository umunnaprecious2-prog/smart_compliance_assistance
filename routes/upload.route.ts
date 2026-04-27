import express from 'express';
import multer from 'multer';
import { extractText, createChunks } from '../utils/file.helper';
import { saveDocumentChunks } from '../services/documentChunk.service';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname);

    const rawText = await extractText(req.file.path);

    const chunks = createChunks(rawText);

    console.log(`Created ${chunks.length} chunks from the PDF.`);
    if (chunks.length > 0) {
      console.log('Sample Chunk 1:', chunks[0].substring(0, 200));
    }

    console.log('--- Extracted Text Snippet ---');
    console.log(rawText.substring(0, 500));

    const savedChunks = await saveDocumentChunks(chunks, req.file.originalname);

    console.log(`✅ Success: ${savedChunks.count} chunks saved to PostgreSQL.`);

    res.status(200).json({
      message: 'File uploaded, extracted, and saved to database successfully',
      charCount: rawText.length,
      totalChunks: chunks.length,
      savedChunks: savedChunks.count,
      snippet: rawText.substring(0, 100) + "..."
    });

  } catch (error) {
    console.error('Extraction Error:', error);
    res.status(500).json({ error: 'Failed to extract text from PDF' });
  }
});

export default router;
