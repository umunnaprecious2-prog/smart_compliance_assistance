import { GoogleGenerativeAI } from "@google/generative-ai";
import { semanticSearch } from "./search.service.ts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const generateAIResponse = async (question: string) => {
    const relevantChunks: any = await semanticSearch(question, 5);

    console.log("Retrieved Chunks for AI:", relevantChunks);

    const contextText = relevantChunks && relevantChunks.length > 0
        ? relevantChunks.map((c: any) => `ID: ${c.id}\nContent: ${c.content}`).join("\n\n")
        : "No relevant document excerpts found.";

    const prompt = `
You are a compliance assistant for a data protection platform.
Answer the question below using ONLY the document excerpts provided.

EXCERPTS:
${contextText}

QUESTION: ${question}

Rules:
- If the answer is not in the excerpts, say: "I cannot find this in the document."
- Always include a citation like [Source: chunk ID or page ref].
- Do not speculate or draw on outside knowledge.

ANSWER:
  `;

    console.log("--- CONSTRUCTED PROMPT ---");
    console.log(prompt);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return {
        answer: responseText,
        citations: relevantChunks.map((c: any) => ({
            chunkId: c.id,
            excerpt: c.content.substring(0, 100) + "..."
        }))
    };
};
