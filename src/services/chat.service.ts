import { GoogleGenerativeAI } from "@google/generative-ai";
import { semanticSearch } from "./search.service.ts";
import { redactPII, containsPII } from "../utils/pii-redactor.ts";
import { getSessionMessages } from "./chat-history.service.ts";
import { MODELS } from "../config/models.ts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const generateFallbackResponse = async (question: string, chunks: any[]): Promise<string> => {
    if (!chunks || chunks.length === 0) {
        return "I cannot find relevant information in the documents to answer your question.";
    }

    const firstChunk = chunks[0];
    const content = firstChunk.content || "";
    let excerpt = content.substring(0, 200);

    if (await containsPII(excerpt)) {
        const redacted = await redactPII(excerpt);
        excerpt = redacted.redactedText;
    }

    return `Based on the available documents: ${excerpt}... [Note: This is a fallback response as the AI model is not available. Please refer to the source documents for complete information.]`;
};

export const calculateConfidence = (chunks: any[], question: string, piiRedacted: boolean): number => {
    if (!chunks || chunks.length === 0) return 0;

    const similarities = chunks.map(c => {
        return c.distance !== undefined ? Math.max(0, Math.min(1, 1 - c.distance)) : 0.4;
    });

    const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / chunks.length;
    const qualityScore = avgSimilarity * 0.4;

    const relevantCount = similarities.filter(s => s > 0.15).length;
    const chunkRelevance = Math.min(relevantCount / 5, 1) * 0.3;

    const piiPenalty = piiRedacted ? -0.2 : 0;

    const questionLength = question.length;
    const clarityScore = (Math.min(questionLength / 50, 1)) * 0.1;

    const score = Math.max(0, Math.min(1, chunkRelevance + qualityScore + piiPenalty + clarityScore));

    console.log(`[Confidence] Total: ${score.toFixed(3)} (Relevance: ${chunkRelevance.toFixed(2)}, Quality: ${qualityScore.toFixed(2)}, PII: ${piiPenalty}, Clarity: ${clarityScore.toFixed(2)})`);

    return score;
};

export const generateAIResponse = async (question: string, sessionId?: number, documentId?: number) => {
    try {
        let conversationContext = '';
        if (sessionId) {
            const previousMessages = await getSessionMessages(sessionId);

            conversationContext = previousMessages
                .map((msg: { role: string; content: any; }) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n\n');
        }

        const relevantChunks: any = await semanticSearch(question, 5, documentId);

        let contextText = relevantChunks && relevantChunks.length > 0
            ? relevantChunks.map((c: any) => `ID: ${c.id}\nContent: ${c.content}`).join("\n\n")
            : "No relevant document excerpts found.";

        let piiRedacted = false;
        let totalEmailCount = 0;
        let totalNameCount = 0;
        let redactedQuestion = question;

        if (await containsPII(question)) {
            const redactionResult = await redactPII(question);
            redactedQuestion = redactionResult.redactedText;
            piiRedacted = true;
            totalEmailCount += redactionResult.detectedPII.filter(p => p.type === 'email').length;
            totalNameCount += redactionResult.detectedPII.filter(p => p.type === 'name').length;
        }

        if (await containsPII(contextText)) {
            const redactionResult = await redactPII(contextText);
            contextText = redactionResult.redactedText;
            piiRedacted = true;
            totalEmailCount += redactionResult.detectedPII.filter(p => p.type === 'email').length;
            totalNameCount += redactionResult.detectedPII.filter(p => p.type === 'name').length;
        }

        const redactionParts = [];
        if (totalEmailCount > 0) redactionParts.push(`${totalEmailCount} email(s)`);
        if (totalNameCount > 0) redactionParts.push(`${totalNameCount} name(s)`);
        const redactionSummary = redactionParts.join(', ');

        const prompt = `
You are a specialized compliance assistant for a data protection and regulatory platform. 
Your ONLY purpose is to answer questions based on the provided document excerpts.

Rules:
1. If the answer is NOT explicitly contained within the excerpts below, you MUST say: "I cannot find this information in the document."
2. Do NOT use any outside knowledge, personal opinions, or general information (e.g., recipes, general history, etc.).
3. Always include a citation in brackets like [Source: chunk ID].
4. If the question is about a person or entity mentioned in the conversation history, link it to the excerpts if possible.

${conversationContext ? `CONVERSATION HISTORY:\n${conversationContext}\n\n` : ''}

EXCERPTS:
${contextText}

QUESTION: ${redactedQuestion}

ANSWER:
`;

        console.log("--- CONSTRUCTED PROMPT ---");
        console.log(prompt);

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured");
        }

        const confidenceScore = calculateConfidence(relevantChunks, redactedQuestion, piiRedacted);

        let responseText: string;
        try {
            const timeoutPromise = new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("API timeout after 30s")), 30000)
            );

            const chatPromise = (async () => {
                const model = genAI.getGenerativeModel({ model: MODELS.GENERATIVE });
                const result = await model.generateContent(prompt);
                return result.response.text();
            })();

            responseText = await Promise.race([chatPromise, timeoutPromise]);
        } catch (apiError) {
            console.error("API Error (full details):", apiError);
            console.warn("Falling back to document excerpt response.");

            if (confidenceScore < 0.45) {
                responseText = "I cannot find any information in the documents related to your question. (AI is currently unavailable, and document relevance is low).";
            } else {
                responseText = await generateFallbackResponse(question, relevantChunks);
            }
        }

        return {
            answer: responseText,
            citations: await Promise.all(relevantChunks.map(async (c: any) => {
                let excerpt = c.content.substring(0, 100);
                if (await containsPII(excerpt)) {
                    const redacted = await redactPII(excerpt);
                    excerpt = redacted.redactedText;
                }
                return {
                    chunkId: c.id,
                    excerpt: excerpt + "..."
                };
            })),
            piiRedacted,
            redactionSummary: piiRedacted ? redactionSummary : undefined,
            confidenceScore
        };
    } catch (error) {
        console.error("Chat Service Error:", error);
        throw error;
    }
};

export const generateAIResponseStream = async function* (
    question: string,
    sessionId: number,
    chunks: any[],
    history: any[],
    documentId?: number
): AsyncGenerator<string> {
    try {
        let conversationContext = '';
        if (history && history.length > 0) {
            conversationContext = history
                .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n\n');
        }

        let contextText = chunks && chunks.length > 0
            ? chunks.map((c: any) => `ID: ${c.id}\nContent: ${c.content}`).join("\n\n")
            : "No relevant document excerpts found.";

        let piiRedacted = false;
        if (await containsPII(question)) {
            const redactionResult = await redactPII(question);
            question = redactionResult.redactedText;
            piiRedacted = true;
        }

        if (await containsPII(contextText)) {
            const redactionResult = await redactPII(contextText);
            contextText = redactionResult.redactedText;
            piiRedacted = true;
        }

        const prompt = `
You are a specialized compliance assistant. Answer using ONLY the provided excerpts.
If the answer is not in the excerpts, say: "I cannot find this in the document."

${conversationContext ? `CONVERSATION HISTORY:\n${conversationContext}\n\n` : ''}

EXCERPTS:
${contextText}

QUESTION: ${question}

ANSWER:
`;

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured");
        }

        try {
            const timeoutPromise = new Promise<AsyncGenerator<string>>((_resolve, reject) =>
                setTimeout(() => reject(new Error("Stream API timeout after 30s")), 30000)
            );

            const chatPromise = (async function* () {
                try {
                    const model = genAI.getGenerativeModel({ model: MODELS.GENERATIVE });
                    const response = await model.generateContentStream(prompt);

                    for await (const chunk of response.stream) {
                        const text = chunk.text();
                        if (text) {
                            yield text;
                        }
                    }
                } catch (apiError) {
                    console.error("Stream Error (full details):", apiError);
                    console.warn("Falling back to document excerpt stream.");
                    for (const chunk of chunks) {
                        let text = chunk.content.substring(0, 200);
                        if (await containsPII(text)) {
                            const redacted = await redactPII(text);
                            text = redacted.redactedText;
                        }
                        yield text;
                        yield "\n\n";
                    }
                }
            })();

            const winner = await Promise.race([chatPromise, timeoutPromise]);

            for await (const chunk of winner) {
                yield chunk;
            }
        } catch (error) {
            console.warn("Stream generation error (using fallback):", (error as any).message);

            const confidence = calculateConfidence(chunks, question, piiRedacted);
            if (confidence < 0.3) {
                yield "I cannot find relevant information in the documents to answer your question.";
            } else {
                for (const chunk of chunks) {
                    let text = chunk.content.substring(0, 200);
                    if (await containsPII(text)) {
                        const redacted = await redactPII(text);
                        text = redacted.redactedText;
                    }
                    yield text;
                    yield "\n\n";
                }
            }
        }
    } catch (error) {
        console.error("Stream Service Error:", error);
        yield `Error: ${(error as any).message}`;
    }
};
