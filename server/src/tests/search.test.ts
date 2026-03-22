import request from 'supertest';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import {
  initSearchTestEnv,
  closeSearchTestEnv,
  resetSearchTestDb,
  getTestApp,
} from './helpers/searchTestHelpers';

let app: ReturnType<typeof getTestApp>;

beforeAll(async () => {
  await initSearchTestEnv();
  app = getTestApp();
});

afterAll(async () => {
  await closeSearchTestEnv();
});

beforeEach(async () => {
  await resetSearchTestDb();
});

describe('Regular search', () => {
  it('should return 200 and users matching username when type=users', async () => {
    await User.create([
      { username: 'alice_reader', email: 'a@test.com', password: 'h' },
      { username: 'bob', email: 'b@test.com', password: 'h' },
    ]);
    const res = await request(app).get('/search').query({ q: 'alice', type: 'users' });
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe('alice_reader');
  });

  it('should return 200 and posts when type=posts', async () => {
    const user = await User.create({ username: 'u', email: 'u@test.com', password: 'h' });
    await Post.create({
      userId: user._id,
      bookName: 'Harry Potter',
      text: 'Great',
      likesCount: 0,
      commentsCount: 0,
    });
    await Post.create({
      userId: user._id,
      bookName: 'Other',
      text: 'Ok',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app).get('/search').query({ q: 'Harry', type: 'posts' });
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].bookName).toBe('Harry Potter');
  });

  it('should return 200 with users and posts when type=all', async () => {
    const user = await User.create({ username: 'searchuser', email: 's@test.com', password: 'h' });
    await Post.create({
      userId: user._id,
      bookName: 'searchuser Book',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app).get('/search').query({ q: 'searchuser', type: 'all' });
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty arrays when q is empty', async () => {
    const res = await request(app).get('/search').query({ type: 'all' });
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.posts).toEqual([]);
  });

  it('should return 400 for invalid type', async () => {
    const res = await request(app).get('/search').query({ q: 'x', type: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('should return no results when nothing matches', async () => {
    const res = await request(app).get('/search').query({ q: 'zzznonexistent', type: 'all' });
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.posts).toEqual([]);
  });
});
