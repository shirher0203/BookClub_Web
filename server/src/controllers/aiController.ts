import { Request, Response } from 'express';
import { Post } from '../models/postModel';
import * as geminiService from '../services/geminiService';
import { searchService } from '../services/searchService';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function clearRateLimitForTesting(): void {
  rateLimitMap.clear();
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

const analyzeCache = new Map<string, { data: geminiService.ReviewAnalysis; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(postId: string | undefined, text: string): string {
  if (postId) return `post:${postId}`;
  return `text:${text.slice(0, 200)}`;
}

/** Remove expired entries from both Maps so long-running servers don't leak memory. */
export function sweepExpiredEntries(now: number = Date.now()): void {
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
  for (const [key, entry] of analyzeCache) {
    if (now >= entry.expiresAt) analyzeCache.delete(key);
  }
}

/** Test helper — seed entries and report sizes so unit tests can verify the sweeper. */
export const _testInternals = {
  seedRateLimit(ip: string, entry: { count: number; resetAt: number }): void {
    rateLimitMap.set(ip, entry);
  },
  seedAnalyze(key: string, entry: { data: geminiService.ReviewAnalysis; expiresAt: number }): void {
    analyzeCache.set(key, entry);
  },
  sizes(): { rateLimit: number; analyze: number } {
    return { rateLimit: rateLimitMap.size, analyze: analyzeCache.size };
  },
  clearAll(): void {
    rateLimitMap.clear();
    analyzeCache.clear();
  },
};

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const sweepTimer = setInterval(() => sweepExpiredEntries(), SWEEP_INTERVAL_MS);
sweepTimer.unref();

export async function search(req: Request, res: Response): Promise<void> {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
    return;
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    const { posts, total } = await searchService.simpleTextSearch('');
    res.json({ results: posts, parsedQuery: { originalQuery: '' }, total });
    return;
  }
  let parsedQuery: geminiService.ParsedQuery;
  try {
    parsedQuery = await geminiService.parseSearchQuery(q);
  } catch {
    parsedQuery = geminiService.fallbackParsing(q);
  }
  let result: Awaited<ReturnType<typeof searchService.searchBooks>>;
  try {
    result = await searchService.searchBooks(parsedQuery);
  } catch {
    result = await searchService.simpleTextSearch(q);
  }
  res.json({
    results: result.posts,
    parsedQuery,
    total: result.total,
  });
}

export async function analyze(req: Request, res: Response): Promise<void> {
  const { postId, text: rawText } = req.body as { postId?: string; text?: string };
  let text = typeof rawText === 'string' ? rawText.trim() : '';
  let resolvedPostId: string | undefined;
  if (postId) {
    const post = await Post.findById(postId).lean();
    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }
    text = (post.text ?? '').trim();
    resolvedPostId = postId;
  }
  if (!text) {
    res.status(400).json({ message: 'Provide postId or text' });
    return;
  }
  const key = cacheKey(resolvedPostId, text);
  const now = Date.now();
  const cached = analyzeCache.get(key);
  if (cached && cached.expiresAt > now) {
    res.json(cached.data);
    return;
  }
  const analysis = await geminiService.analyzeReview(text);
  analyzeCache.set(key, { data: analysis, expiresAt: now + CACHE_TTL_MS });
  res.json(analysis);
}
