import { Post } from '../models/postModel';
import type { ParsedQuery } from './geminiService';

function regexFor(keyword: string): RegExp {
  return new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function buildFilter(parsed: ParsedQuery): Record<string, unknown> {
  const contentConditions: Record<string, unknown>[] = [];
  const hardFilters: Record<string, unknown>[] = [];

  if (parsed.titleKeywords && parsed.titleKeywords.length > 0) {
    for (const k of parsed.titleKeywords) {
      contentConditions.push({ bookName: regexFor(k) });
    }
  }
  if (parsed.authorKeywords && parsed.authorKeywords.length > 0) {
    for (const k of parsed.authorKeywords) {
      contentConditions.push({ bookAuthor: regexFor(k) });
    }
  }
  if (parsed.inferredBooks && parsed.inferredBooks.length > 0) {
    for (const b of parsed.inferredBooks) {
      contentConditions.push({ bookName: regexFor(b) });
    }
  }
  if (parsed.genres && parsed.genres.length > 0) {
    for (const g of parsed.genres) {
      contentConditions.push({ genre: regexFor(g) });
    }
  }
  if (parsed.minScore != null && parsed.minScore >= 1 && parsed.minScore <= 5) {
    hardFilters.push({ score: { $gte: parsed.minScore } });
  }

  const parts: Record<string, unknown>[] = [];
  if (contentConditions.length > 0) {
    parts.push({ $or: contentConditions });
  }
  parts.push(...hardFilters);

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

function relevanceScore(post: { bookName?: string; bookAuthor?: string; genre?: string }, parsed: ParsedQuery): number {
  let score = 0;
  const name = (post.bookName ?? '').toLowerCase();
  const author = (post.bookAuthor ?? '').toLowerCase();
  const genre = (post.genre ?? '').toLowerCase();

  if (parsed.inferredBooks) {
    for (const b of parsed.inferredBooks) {
      if (name.includes(b.toLowerCase())) { score += 30; break; }
    }
  }
  if (parsed.titleKeywords) {
    for (const k of parsed.titleKeywords) {
      if (name.includes(k.toLowerCase())) score += 20;
    }
  }
  if (parsed.authorKeywords) {
    for (const k of parsed.authorKeywords) {
      if (author.includes(k.toLowerCase())) score += 10;
    }
  }
  if (parsed.genres) {
    for (const g of parsed.genres) {
      if (genre.includes(g.toLowerCase())) score += 5;
    }
  }
  return score;
}

class SearchService {
  async searchBooks(parsedQuery: ParsedQuery): Promise<{ posts: Awaited<ReturnType<typeof Post.find>>; total: number }> {
    const filter = buildFilter(parsedQuery);
    const [posts, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).limit(100).populate('userId', 'username profileImage _id').lean(),
      Post.countDocuments(filter),
    ]);
    posts.sort((a, b) => relevanceScore(b, parsedQuery) - relevanceScore(a, parsedQuery));
    return { posts, total };
  }

  async simpleTextSearch(query: string): Promise<{ posts: Awaited<ReturnType<typeof Post.find>>; total: number }> {
    const trimmed = query.trim();
    if (!trimmed) {
      const posts = await Post.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'username profileImage _id').lean();
      return { posts, total: await Post.countDocuments() };
    }
    const regex = regexFor(trimmed);
    const filter = { $or: [{ bookName: regex }, { bookAuthor: regex }] };
    const [posts, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).limit(100).populate('userId', 'username profileImage _id').lean(),
      Post.countDocuments(filter),
    ]);
    return { posts, total };
  }
}

export const searchService = new SearchService();
