import { Router } from 'express';
import { generateAIResponse } from '../services/chat.service.ts';

const chatRouter = Router();

chatRouter.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const result = await generateAIResponse(question);

        res.status(200).json({
            answer: result.answer,
            citations: result.citations
        });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

export default chatRouter;
