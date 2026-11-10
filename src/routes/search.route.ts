import { Router } from 'express';
import { semanticSearch } from '../services/search.service.ts';
import { authenticate } from '../middleware/auth.middleware.ts';

const searchRouter = Router();

/**
 * @swagger
 * /api/query:
 *   post:
 *     summary: Perform semantic search on documents
 *     description: Searches all indexed documents using semantic similarity based on the query
 *     tags:
 *       - Search
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The search query
 *                 example: "compliance requirements"
 *     responses:
 *       200:
 *         description: Search results with similarity scores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                   description: The original query
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SearchResult'
 *                   description: Array of matching chunks ranked by similarity
 *       400:
 *         description: Bad request - missing question parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
searchRouter.post('/query', authenticate, async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const matches = await semanticSearch(question);

        res.status(200).json({
            query: question,
            results: matches
        });
    } catch (error) {
        console.error('Search Error:', error);
        res.status(500).json({ error: 'Failed to perform semantic search' });
    }
});

export default searchRouter;
