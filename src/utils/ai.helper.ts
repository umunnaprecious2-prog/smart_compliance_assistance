import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw new Error("Failed to generate vector embedding");
  }
};
