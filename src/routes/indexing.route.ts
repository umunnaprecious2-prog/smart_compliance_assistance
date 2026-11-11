import { Router } from 'express';
import { indexAllDocuments, getIndexingStatus } from '../services/indexing.service.ts';
import { requireAdmin } from '../middleware/auth.middleware.ts';

const indexRouter = Router();

/**
 * @swagger
 * /api/admin/index/status:
 *   get:
 *     summary: Get current indexing status
 *     description: Retrieves the status of the document indexing system
 *     tags:
 *       - Admin
 *     responses:
 *       200:
 *         description: Current indexing status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *                   properties:
 *                     indexed_documents:
 *                       type: number
 *                       description: Total number of indexed documents
 *                     total_chunks:
 *                       type: number
 *                       description: Total number of document chunks
 *                     last_update:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of last indexing operation
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
indexRouter.get('/status', requireAdmin, async (req, res) => {
  try {
    const status = await getIndexingStatus();
    res.status(200).json({
      message: 'Indexing status retrieved',
      status,
    });
  } catch (error) {
    console.error('Status Check Error:', error);
    res.status(500).json({ error: 'Failed to retrieve indexing status' });
  }
});

/**
 * @swagger
 * /api/admin/index:
 *   post:
 *     summary: Trigger full document indexing
 *     description: |
 *       Initiates a complete re-indexing of all documents in the system.
 *       This operation extracts text, creates chunks, and generates embeddings for all documents.
 *       This is an admin-only operation and may take considerable time.
 *     tags:
 *       - Admin
 *     responses:
 *       200:
 *         description: Indexing completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   properties:
 *                     documents_processed:
 *                       type: number
 *                     chunks_created:
 *                       type: number
 *                     total_time_ms:
 *                       type: number
 *       500:
 *         description: Internal server error during indexing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
indexRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const result = await indexAllDocuments();

    res.status(200).json({
      message: 'Indexing completed',
      result,
    });
  } catch (error) {
    console.error('Indexing Error:', error);
    res.status(500).json({ error: 'Failed to complete indexing' });
  }
});

export default indexRouter;
