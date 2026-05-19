import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODELS } from "../config/models.ts";

interface RedactionResult {
  redactedText: string;
  detectedPII: Array<{
    type: string;
    value: string;
    placeholder: string;
    confidence?: number;
  }>;
}

function getGenAI() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";
  return new GoogleGenerativeAI(apiKey);
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const COMMON_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "up", "about", "into", "through", "as", "is", "was", "are", "be", "been", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "must", "can", "shall", "used", "just", "only", "very", "too", "also",
  "more", "most", "such", "some", "same", "different", "other", "which", "who", "what",
  "where", "when", "why", "how", "all", "each", "every", "either", "neither", "much",
  "many", "few", "several", "both", "one", "two", "three", "four", "five", "six", "seven"
]);

const NAME_VALIDATION_RULES = {
  minLength: 2,
  maxLength: 30,
  minWords: 1,
  maxWords: 4,
  excludeCommonWords: true,
  requiresCapital: true
};

async function detectNamesWithAI(text: string): Promise<Array<{ name: string, confidence: number }>> {
  try {
    const timeoutPromise = new Promise<Array<{ name: string, confidence: number }>>((_, reject) =>
      setTimeout(() => reject(new Error("NER timeout after 8s")), 8000)
    );

    const nerPromise = (async () => {
      const prompt = `Extract all person names from this text. Return ONLY a JSON array with objects containing "name" and "confidence" (0-1 scale). Names should be proper nouns that clearly refer to people. Filter out: common words, place names, organization names, or generic terms.

Text: "${text}"

Return only valid JSON array, no markdown or explanation:`;

      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: MODELS.GENERATIVE });
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    })();

    return await Promise.race([nerPromise, timeoutPromise]);
  } catch (error) {
    console.warn("AI NER failed, using fallback regex", (error as any).message);
    return [];
  }
}

function validateNameCandidate(name: string, confidence: number): boolean {
  if (!name || confidence < 0.65) return false;

  const trimmed = name.trim();
  if (trimmed.length < NAME_VALIDATION_RULES.minLength || trimmed.length > NAME_VALIDATION_RULES.maxLength) {
    return false;
  }

  const words = trimmed.split(/\s+/);
  if (words.length < NAME_VALIDATION_RULES.minWords || words.length > NAME_VALIDATION_RULES.maxWords) {
    return false;
  }

  if (NAME_VALIDATION_RULES.excludeCommonWords) {
    if (words.some(word => COMMON_WORDS.has(word.toLowerCase()))) {
      return false;
    }
  }

  if (NAME_VALIDATION_RULES.requiresCapital) {
    if (!words.every(word => /^[A-Z]/.test(word))) {
      return false;
    }
  }

  return true;
}

const SIMPLE_NAME_REGEX = /\b([A-Z][a-z.]*(?:[\s-][A-Z][a-z.]*)+|[A-Z]{2,}(?:[\s-][A-Z]{2,})+)\b/g;

const SENTENCE_START_WORDS = new Set(['The', 'My', 'This', 'That', 'In', 'On', 'At', 'To', 'For', 'Of', 'By', 'From', 'With']);

function detectNamesWithRegex(text: string): Array<{ name: string, confidence: number }> {
  SIMPLE_NAME_REGEX.lastIndex = 0;
  const matches = Array.from(text.matchAll(SIMPLE_NAME_REGEX));
  return matches
    .filter(match => {
      const firstWord = match[1].split(/\s+/)[0];
      if (SENTENCE_START_WORDS.has(firstWord) && match.index === 0) return false;
      return true;
    })
    .map(match => ({
      name: match[1],
      confidence: 0.7
    }));
}

export const redactPII = async (text: string): Promise<RedactionResult> => {
  let redactedText = text;
  const detectedPII: RedactionResult['detectedPII'] = [];
  let emailCounter = 1;
  let nameCounter = 1;

  EMAIL_REGEX.lastIndex = 0;
  const emailMatches = text.matchAll(EMAIL_REGEX);
  for (const match of emailMatches) {
    const value = match[0];
    const placeholder = `[EMAIL_${emailCounter}]`;

    detectedPII.push({
      type: 'email',
      value,
      placeholder,
      confidence: 1.0
    });

    redactedText = redactedText.replace(value, placeholder);
    emailCounter++;
  }

  let aiNames = await detectNamesWithAI(text);
  const detectedNames = new Set<string>();

  for (const candidate of aiNames) {
    if (validateNameCandidate(candidate.name, candidate.confidence)) {
      detectedNames.add(candidate.name);
    }
  }

  if (detectedNames.size === 0) {
    const regexNames = detectNamesWithRegex(text);
    for (const candidate of regexNames) {
      if (validateNameCandidate(candidate.name, candidate.confidence)) {
        detectedNames.add(candidate.name);
      }
    }
  }

  for (const name of Array.from(detectedNames)) {
    const placeholder = `[NAME_${nameCounter}]`;

    const confidence = aiNames.find(n => n.name === name)?.confidence || 0.7;
    detectedPII.push({
      type: 'name',
      value: name,
      placeholder,
      confidence
    });

    redactedText = redactedText.replace(new RegExp(`\\b${name}\\b`, 'g'), placeholder);
    nameCounter++;
  }

  return {
    redactedText,
    detectedPII,
  };
};

export const containsPII = async (text: string): Promise<boolean> => {
  EMAIL_REGEX.lastIndex = 0;
  if (EMAIL_REGEX.test(text)) return true;

  try {
    const aiNames = await detectNamesWithAI(text);
    for (const candidate of aiNames) {
      if (validateNameCandidate(candidate.name, candidate.confidence)) {
        return true;
      }
    }
  } catch (error) {
    SIMPLE_NAME_REGEX.lastIndex = 0;
    return SIMPLE_NAME_REGEX.test(text);
  }

  // Final check with regex names if AI returned nothing but didn't throw
  SIMPLE_NAME_REGEX.lastIndex = 0;
  const regexNames = detectNamesWithRegex(text);
  for (const candidate of regexNames) {
    if (validateNameCandidate(candidate.name, candidate.confidence)) {
      return true;
    }
  }

  return false;
};
