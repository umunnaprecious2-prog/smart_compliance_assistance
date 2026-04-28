import { Router } from 'express';
import { generateAIResponse } from '../services/chat.service.ts';

const chatRouter = Router();

const INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /ignore all instructions/i,
    /system override/i,
    /new rules apply/i,
    /you are now a/i,
    /disregard the rules/i,
    /forget everything/i
];

chatRouter.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const isInjectionAttempt = INJECTION_PATTERNS.some(pattern => pattern.test(question));

        if (isInjectionAttempt) {
            return res.status(400).json({
                error: 'Security Alert: This question attempts to override system instructions and has been blocked.'
            });
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
