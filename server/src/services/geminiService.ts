import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env';

/**
 * Search intent from LLM; each field maps to Post model query:
 * - titleKeywords → Post.bookName
 * - authorKeywords → Post.bookAuthor
 * - genres → Post.genre
 * - minScore → Post.score
 */
export interface ParsedQuery {
  titleKeywords?: string[];
  authorKeywords?: string[];
  genres?: string[];
  inferredBooks?: string[];
  minScore?: number;
  originalQuery: string;
}

export interface ReviewAnalysis {
  sentiment: 'positive' | 'negative' | 'mixed';
  themes: string[];
  summary: string;
}

const PARSED_QUERY_SYSTEM = `You are a search query parser for a book review app. Given a user's natural language search, return a JSON object with these optional fields (omit if not mentioned):

FIELD EXTRACTION (extract from the query, fix typos):
- titleKeywords: string[] — words from the book title the user typed, with typos corrected. Example: "hary poter" → ["Harry", "Potter"].
- authorKeywords: string[] — corrected author names. Fix typos and misspellings. Include the surname as a separate entry for flexible matching. Example: "jk rolling" → ["J.K. Rowling", "Rowling"].
- genres: string[] — genre labels (e.g. fantasy, romance, sci-fi, thriller). Put genre descriptors here, NOT in titleKeywords.
- minScore: number (1-5) — minimum star rating, only if explicitly requested.

BOOK INFERENCE (guess what book the user means):
- inferredBooks: string[] — your best guesses for the full, correct book title(s) the user is looking for. Use this when you can identify the book from context, description, or partial/misspelled names. Example: "that wizard school book by jk rolling" → ["Harry Potter and the Philosopher's Stone", "Harry Potter"]. Include both the full title and a short version if the full title is long.

- originalQuery: string — the exact user query, unchanged.

Important rules:
- Fix obvious typos and misspellings in all fields (e.g. "tolkeen" → "Tolkien").
- Always try to populate inferredBooks when you can recognize the book, even partially.
- Do NOT include a yearRange field — the database has no publication year data.
- Return ONLY valid JSON, no markdown or extra text.

Database fields that will be searched: bookName (string), bookAuthor (string), genre (string), score (number 1-5).`;

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
    const prompt = `${PARSED_QUERY_SYSTEM}\n\nUser search: "${userQuery}"\n\nParse into the JSON structure. Return only the JSON object.`;
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
