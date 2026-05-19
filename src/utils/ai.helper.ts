import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "");

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const timeoutPromise = new Promise<number[]>((_resolve, reject) =>
        setTimeout(() => reject(new Error("Embedding API timeout after 5s")), 5000)
      );

      const embeddingPromise = (async () => {
        const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
        const model = genAI.getGenerativeModel({ model: embeddingModel });
        const result = await model.embedContent(text);
        console.log(`[Embeddings] Using Gemini embeddings (${embeddingModel})`);
        return result.embedding.values;
      })();

      return await Promise.race([embeddingPromise, timeoutPromise]);
    } catch (error) {
      console.warn("[Embeddings] Gemini embedding failed:", (error as any).message);
    }
  }

  throw new Error("Embedding generation failed. Please configure GEMINI_API_KEY and ensure your API key has access to gemini-embedding-2.");
};
