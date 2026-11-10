import { Router } from 'express';
import { generateAIResponse, generateAIResponseStream, calculateConfidence } from '../services/chat.service.ts';
import { saveMessage, createSession, getSessionMessages, getRecentSessions, getSessionWithMessages } from '../services/chat-history.service.ts';
import { semanticSearch } from '../services/search.service.ts';
import { getLatestDocument } from '../services/documentChunk.service.ts';

const chatRouter = Router();

const INJECTION_PATTERNS = [
    /ignore (?:previous|all|the)? ?instructions/i,
    /system override/i,
    /new rules apply/i,
    /you are now a/i,
    /disregard (?:the)? ?rules/i,
    /forget (?:about|everything|what)/i,
    /acting as/i,
    /dan mode/i
];

/**
 * @swagger
 * /api/chat/ask:
 *   post:
 *     summary: Ask a question and get an AI-powered response
 *     description: Sends a question to the AI assistant which searches documents and provides an answer with confidence scoring
 *     tags:
 *       - Chat
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
 *                 description: The question to ask the AI assistant
 *                 example: "What are the compliance requirements?"
 *               sessionId:
 *                 type: number
 *                 description: Optional session ID for conversation continuity
 *                 example: 1
 *               documentId:
 *                 type: number
 *                 description: Optional specific document ID to search within
 *                 example: 5
 *     responses:
 *       200:
 *         description: Successful AI response with confidence score and session ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: number
 *                 answer:
 *                   type: string
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 piiRedacted:
 *                   type: boolean
 *                 confidenceScore:
 *                   type: number
 *                   format: float
 *                 warning:
 *                   type: string
 *       400:
 *         description: Bad request - missing question or security alert
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
chatRouter.post('/ask', async (req, res) => {
    try {
        const { question, sessionId, documentId } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const isInjectionAttempt = INJECTION_PATTERNS.some(pattern => pattern.test(question));

        if (isInjectionAttempt) {
            return res.status(400).json({
                error: 'Security Alert: This question attempts to override system instructions and has been blocked.'
            });
        }

        let currentSessionId: number | null = null;
        
        if (sessionId) {
            const parsed = parseInt(String(sessionId), 10);
            if (isNaN(parsed)) {
                return res.status(400).json({ error: 'Invalid session ID format' });
            }
            
            const sessionExists = await getSessionWithMessages(parsed);
            if (!sessionExists) {
                const newSession = await createSession(question);
                if (!newSession || !newSession.id) {
                    return res.status(500).json({ error: 'Failed to create chat session' });
                }
                currentSessionId = newSession.id;
            } else {
                currentSessionId = parsed;
            }
        } else {
            const newSession = await createSession(question);
            if (!newSession || !newSession.id) {
                return res.status(500).json({ error: 'Failed to create chat session' });
            }
            currentSessionId = newSession.id;
        }

        if (!currentSessionId || isNaN(currentSessionId)) {
            return res.status(400).json({ error: 'Invalid session ID' });
        }

        await saveMessage(currentSessionId, 'user', question);

        let activeDocId = documentId;
        if (!activeDocId) {
            const latestDoc = await getLatestDocument();
            activeDocId = latestDoc?.id;
        }

        const result = await generateAIResponse(question, currentSessionId, activeDocId);

        await saveMessage(
            currentSessionId,
            'assistant',
            result.answer,
            result.citations,
            result.piiRedacted,
            result.confidenceScore
        );

        res.status(200).json({
            sessionId: currentSessionId,
            answer: result.answer,
            citations: result.citations,
            piiRedacted: result.piiRedacted,
            confidenceScore: result.confidenceScore,
            warning: result.piiRedacted
                ? `Sensitive information (${result.redactionSummary}) was redacted before processing.`
                : undefined
        });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

/**
 * @swagger
 * /api/chat/session/{sessionId}:
 *   get:
 *     summary: Get messages from a specific chat session
 *     description: Retrieves all messages from a conversation session by ID
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: number
 *         description: The session ID
 *     responses:
 *       200:
 *         description: Session messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: number
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatMessage'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
chatRouter.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const messages = await getSessionMessages(parseInt(sessionId));

        if (!messages || messages.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.status(200).json({
            sessionId: parseInt(sessionId),
            messages: messages
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get recent chat sessions
 *     description: Retrieves a list of recent conversation sessions with preview of last message
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: List of recent sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       title:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       lastMessage:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
chatRouter.get('/sessions', async (req, res) => {
    try {
        const sessions = await getRecentSessions(20);
        
        res.status(200).json({
            sessions: sessions.map((session: { id: any; title: any; createdAt: any; updatedAt: any; messages: { content: any; }[]; }) => ({
                id: session.id,
                title: session.title,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                lastMessage: session.messages[0]?.content || null
            }))
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

/**
 * @swagger
 * /api/chat/ask-stream:
 *   post:
 *     summary: Stream AI response as it's being generated
 *     description: Returns a Server-Sent Events stream of the AI response being generated in real-time
 *     tags:
 *       - Chat
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
 *               sessionId:
 *                 type: number
 *               documentId:
 *                 type: number
 *     responses:
 *       200:
 *         description: Stream of text chunks
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
chatRouter.post('/ask-stream', async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const { question, sessionId: sessionIdParam, documentId } = req.body;

        if (!question || question.trim().length === 0) {
            res.write(`data: ${JSON.stringify({ error: "Question is required" })}\n\n`);
            res.end();
            return;
        }

        const isInjectionAttempt = INJECTION_PATTERNS.some(pattern => pattern.test(question));
        if (isInjectionAttempt) {
            res.write(`data: ${JSON.stringify({ error: "Security Alert: This question attempts to override system instructions and has been blocked." })}\n\n`);
            res.end();
            return;
        }

        let currentSessionId: number | null = null;
        if (sessionIdParam) {
            const parsed = parseInt(String(sessionIdParam), 10);
            if (isNaN(parsed)) {
                res.write(`data: ${JSON.stringify({ error: "Invalid session ID format" })}\n\n`);
                res.end();
                return;
            }
            
            const sessionExists = await getSessionWithMessages(parsed);
            if (!sessionExists) {
                const newSession = await createSession(question);
                if (!newSession || !newSession.id) {
                    res.write(`data: ${JSON.stringify({ error: "Failed to create chat session" })}\n\n`);
                    res.end();
                    return;
                }
                currentSessionId = newSession.id;
            } else {
                currentSessionId = parsed;
            }
        } else {
            const newSession = await createSession(question);
            if (!newSession || !newSession.id) {
                res.write(`data: ${JSON.stringify({ error: "Failed to create chat session" })}\n\n`);
                res.end();
                return;
            }
            currentSessionId = newSession.id;
        }

        if (!currentSessionId || isNaN(currentSessionId)) {
            res.write(`data: ${JSON.stringify({ error: "Invalid session ID" })}\n\n`);
            res.end();
            return;
        }

        res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

        await saveMessage(currentSessionId, 'user', question);

        let activeDocId = documentId;
        if (!activeDocId) {
            const latestDoc = await getLatestDocument();
            activeDocId = latestDoc?.id;
        }

        const relevantChunks: any[] = (await semanticSearch(question, 5, activeDocId)) as any;
        const history = await getSessionMessages(currentSessionId);

        const stream = generateAIResponseStream(question, currentSessionId, relevantChunks, history, activeDocId);

        let fullResponse = "";
        for await (const chunk of stream) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        const confidenceScore = calculateConfidence(relevantChunks, question, false);
        const citations = relevantChunks.slice(0, 3).map((chunk: any) => ({
            chunkId: chunk.id,
            excerpt: chunk.content.substring(0, 100)
        }));

        await saveMessage(
            currentSessionId,
            'assistant',
            fullResponse,
            citations,
            false,
            confidenceScore
        );

        res.write(`data: ${JSON.stringify({ done: true, confidenceScore, citations })}\n\n`);
        res.end();
    } catch (error: any) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ error: "An internal error occurred while processing your request." })}\n\n`);
        res.end();
    }
});

export default chatRouter;
