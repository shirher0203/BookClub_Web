import request from 'supertest';
import mongoose from 'mongoose';
import { Post } from '../models/postModel';
import { User } from '../models/userModel';
import {
  initAiTestEnv,
  closeAiTestEnv,
  resetAiTestDb,
  getTestApp,
} from './helpers/aiTestHelpers';
import { clearRateLimitForTesting } from '../controllers/aiController';
import * as geminiService from '../services/geminiService';
import { searchService } from '../services/searchService';

jest.mock('../services/geminiService');

const mockedGemini = jest.mocked(geminiService);

let app: ReturnType<typeof getTestApp>;

beforeAll(async () => {
  await initAiTestEnv();
  app = getTestApp();
});

afterAll(async () => {
  await closeAiTestEnv();
});

beforeEach(async () => {
  await resetAiTestDb();
  clearRateLimitForTesting();
  jest.clearAllMocks();
});

describe('AI Search (controller)', () => {
  it('should return 200 and results shape when q is provided', async () => {
    const parsed = { originalQuery: 'fantasy', titleKeywords: ['fantasy'] };
    mockedGemini.parseSearchQuery.mockResolvedValue(parsed);

    const res = await request(app)
      .get('/ai/search')
      .query({ q: 'fantasy books' })
      .set('x-forwarded-for', '127.0.0.1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('parsedQuery');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.parsedQuery.originalQuery).toBe('fantasy');
    expect(mockedGemini.parseSearchQuery).toHaveBeenCalledWith('fantasy books');
  });

  it('should return 200 with empty results when q is empty', async () => {
    const res = await request(app).get('/ai/search').set('x-forwarded-for', '127.0.0.2');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.parsedQuery.originalQuery).toBe('');
    expect(res.body.total).toBe(0);
  });

  it('should return 429 after exceeding rate limit', async () => {
    mockedGemini.parseSearchQuery.mockResolvedValue({ originalQuery: 'x' });

    const ip = '192.168.1.1';
    for (let i = 0; i < 10; i++) {
      const r = await request(app).get('/ai/search').query({ q: 'test' }).set('x-forwarded-for', ip);
      expect(r.status).toBe(200);
    }
    const res = await request(app).get('/ai/search').query({ q: 'test' }).set('x-forwarded-for', ip);
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many/i);
  });

  it('should fallback to simpleTextSearch when parseSearchQuery throws', async () => {
    mockedGemini.parseSearchQuery.mockRejectedValue(new Error('API error'));
    mockedGemini.fallbackParsing.mockReturnValue({ originalQuery: 'fallback' });

    const res = await request(app).get('/ai/search').query({ q: 'foo' }).set('x-forwarded-for', '127.0.0.3');

    expect(res.status).toBe(200);
    expect(res.body.parsedQuery.originalQuery).toBe('fallback');
  });
});

describe('AI Analyze (controller)', () => {
  it('should return 200 and analysis when text is provided', async () => {
    const analysis = { sentiment: 'positive' as const, themes: ['adventure'], summary: 'Good read.' };
    mockedGemini.analyzeReview.mockResolvedValue(analysis);

    const res = await request(app).post('/ai/analyze').send({ text: 'I loved this book.' });

    expect(res.status).toBe(200);
    expect(res.body.sentiment).toBe('positive');
    expect(res.body.themes).toEqual(['adventure']);
    expect(res.body.summary).toBe('Good read.');
    expect(mockedGemini.analyzeReview).toHaveBeenCalledWith('I loved this book.');
  });

  it('should return 400 when neither postId nor text provided', async () => {
    const res = await request(app).post('/ai/analyze').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/postId|text/i);
  });

  it('should return 404 when postId does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post('/ai/analyze').send({ postId: fakeId.toString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should return 200 with analysis when postId exists', async () => {
    const user = await User.create({ username: 'u', email: 'u@test.com', password: 'h' });
    const post = await Post.create({
      userId: user._id,
      bookName: 'Book',
      text: 'Great story.',
      likesCount: 0,
      commentsCount: 0,
    });
    const analysis = { sentiment: 'positive' as const, themes: ['story'], summary: 'Great.' };
    mockedGemini.analyzeReview.mockResolvedValue(analysis);

    const res = await request(app).post('/ai/analyze').send({ postId: post._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.sentiment).toBe('positive');
    expect(mockedGemini.analyzeReview).toHaveBeenCalledWith('Great story.');
  });
});

describe('SearchService (real DB)', () => {
  it('should find posts by bookName with simpleTextSearch', async () => {
    const user = await User.create({ username: 'u', email: 'u@test.com', password: 'h' });
    await Post.create({
      userId: user._id,
      bookName: 'Harry Potter',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });
    await Post.create({
      userId: user._id,
      bookName: 'Other Book',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });

    const { posts, total } = await searchService.simpleTextSearch('Harry');

    expect(total).toBe(1);
    expect(posts).toHaveLength(1);
    expect((posts[0] as { bookName: string }).bookName).toBe('Harry Potter');
  });

  it('should find posts by ParsedQuery with searchBooks', async () => {
    const user = await User.create({ username: 'u', email: 'u@test.com', password: 'h' });
    await Post.create({
      userId: user._id,
      bookName: 'Fantasy Novel',
      genre: 'fantasy',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });
    await Post.create({
      userId: user._id,
      bookName: 'Romance Novel',
      genre: 'romance',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });

    const { posts, total } = await searchService.searchBooks({
      originalQuery: 'fantasy',
      genres: ['fantasy'],
    });

    expect(total).toBe(1);
    expect(posts).toHaveLength(1);
    expect((posts[0] as { genre: string }).genre).toBe('fantasy');
  });
});
