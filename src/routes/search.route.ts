import { Router } from 'express';
import { semanticSearch } from '../services/search.service.ts';

const searchRouter = Router();

searchRouter.post('/query', async (req, res) => {
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
