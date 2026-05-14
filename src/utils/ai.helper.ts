import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "");

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY for embedding generation.");
  }

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Embedding API timeout after 5s")), 5000)
  );

  const embeddingPromise = (async () => {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  })();

  return await Promise.race([embeddingPromise, timeoutPromise]) as number[];
};
