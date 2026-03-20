import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env';

/**
 * Search intent from LLM; each field maps to Post model query:
 * - titleKeywords → Post.bookName
 * - authorKeywords → Post.bookAuthor
 * - genres → Post.genre
 * - yearRange → Post.createdAt (year filter)
 * - minScore → Post.score
 */
export interface ParsedQuery {
  titleKeywords?: string[];
  authorKeywords?: string[];
  genres?: string[];
  yearRange?: { start?: number; end?: number };
  minScore?: number;
  originalQuery: string;
}

export interface ReviewAnalysis {
  sentiment: 'positive' | 'negative' | 'mixed';
  themes: string[];
  summary: string;
}

const SCHEMA_DESCRIPTION = `BookClub Post schema fields: bookName (string), bookAuthor (string, optional), genre (string, optional), score (number 1-5, optional), createdAt (Date).`;

const PARSED_QUERY_SYSTEM = `You are a search query parser. Given a user's natural language search about books or reviews, return a JSON object with these optional fields only (use null or omit if not specified):
- titleKeywords: string[] (words from book titles)
- authorKeywords: string[] (author names or words)
- genres: string[] (e.g. fantasy, romance)
- yearRange: { start?: number, end?: number } (publication or review year)
- minScore: number (1-5 minimum star rating)
- originalQuery: string (the exact user query)

Return ONLY valid JSON, no markdown or extra text.`;

function getModel() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { temperature: 0.2 } });
}

export async function parseSearchQuery(userQuery: string): Promise<ParsedQuery> {
  try {
    const model = getModel();
    const prompt = `${PARSED_QUERY_SYSTEM}\n\n${SCHEMA_DESCRIPTION}\n\nUser search: "${userQuery}"\n\nParse into the JSON structure. Return only the JSON object.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as ParsedQuery;
    if (typeof parsed.originalQuery !== 'string') parsed.originalQuery = userQuery;
    return parsed;
  } catch {
    return fallbackParsing(userQuery);
  }
}

export function fallbackParsing(userQuery: string): ParsedQuery {
  const trimmed = userQuery.trim();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
  return {
    titleKeywords: words.length > 0 ? words : undefined,
    originalQuery: userQuery,
  };
}

export async function analyzeReview(postText: string): Promise<ReviewAnalysis> {
  const model = getModel();
  const prompt = `Analyze this book review text. Return ONLY a JSON object with:
- sentiment: "positive" | "negative" | "mixed"
- themes: string[] (2-5 short theme labels)
- summary: string (1-2 sentences)

Return only valid JSON, no markdown or other text.

Review text:\n${postText.slice(0, 8000)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned) as ReviewAnalysis;
}
