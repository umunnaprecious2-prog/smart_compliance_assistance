import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedEmbeddingModel: string | null | undefined = undefined;

export async function getAvailableEmbeddingModel(): Promise<string | null> {
    if (cachedEmbeddingModel !== undefined) {
        return cachedEmbeddingModel;
    }

    const modelsToTry = [
        "models/embedding-001",
        "embedding-001",
        "models/text-embedding-004",
        "text-embedding-004",
        "models/universal-sentence-encoder",
        "universal-sentence-encoder"
    ];

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        console.warn("[Models] No API key configured. Embeddings will be unavailable.");
        cachedEmbeddingModel = null;
        return null;
    }

    for (const modelName of modelsToTry) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.embedContent("test");

            cachedEmbeddingModel = modelName;
            console.log(`[Models] Auto-detected embedding model: ${cachedEmbeddingModel}`);
            return cachedEmbeddingModel;
        } catch (error) {
            continue;
        }
    }

    console.warn("[Models] No embedding models available on your API key. Vector search will be disabled, using keyword search instead.");
    cachedEmbeddingModel = null;
    return null;
}

export function getGenerativeModel(): string {
    return process.env.GEMINI_MODEL || "gemini-pro";
}

export const MODELS = {
    GENERATIVE: getGenerativeModel(),
} as const;
