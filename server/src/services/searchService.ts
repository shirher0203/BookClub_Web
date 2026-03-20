import { Post } from '../models/postModel';
import type { ParsedQuery } from './geminiService';

function regexFor(keyword: string): RegExp {
  return new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function buildFilter(parsed: ParsedQuery): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  if (parsed.titleKeywords && parsed.titleKeywords.length > 0) {
    conditions.push({
      $or: parsed.titleKeywords.map((k) => ({ bookName: regexFor(k) })),
    });
  }
  if (parsed.authorKeywords && parsed.authorKeywords.length > 0) {
    conditions.push({
      $or: parsed.authorKeywords.map((k) => ({ bookAuthor: regexFor(k) })),
    });
  }
  if (parsed.genres && parsed.genres.length > 0) {
    conditions.push({
      $or: parsed.genres.map((g) => ({ genre: regexFor(g) })),
    });
  }
  if (parsed.minScore != null && parsed.minScore >= 1 && parsed.minScore <= 5) {
    conditions.push({ score: { $gte: parsed.minScore } });
  }
  if (parsed.yearRange) {
    const { start, end } = parsed.yearRange;
    const dateCond: { $gte?: Date; $lte?: Date } = {};
    if (start != null) dateCond.$gte = new Date(start, 0, 1);
    if (end != null) dateCond.$lte = new Date(end, 11, 31, 23, 59, 59);
    if (Object.keys(dateCond).length > 0) {
      conditions.push({ createdAt: dateCond });
    }
  }

  if (conditions.length === 0) return {};
  return { $and: conditions };
}

class SearchService {
  async searchBooks(parsedQuery: ParsedQuery): Promise<{ posts: Awaited<ReturnType<typeof Post.find>>; total: number }> {
    const filter = buildFilter(parsedQuery);
    const [posts, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).limit(100).populate('userId', 'username profileImage _id').lean(),
      Post.countDocuments(filter),
    ]);
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
