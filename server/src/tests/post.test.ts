import request from 'supertest';
import mongoose from 'mongoose';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import {
  initPostTestEnv,
  closePostTestEnv,
  resetPostTestDb,
  getTestApp,
  USERS,
  POSTS,
} from './helpers/postTestHelpers';

let app: ReturnType<typeof getTestApp>;

beforeAll(async () => {
  await initPostTestEnv();
  app = getTestApp();
});

afterAll(async () => {
  await closePostTestEnv();
});

beforeEach(async () => {
  await resetPostTestDb();
});

describe('Posts CRUD', () => {
  it('should create post 201 with bookName and return populated post', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'The Great Book')
      .field('text', 'Loved it');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.bookName).toBe('The Great Book');
    expect(res.body.text).toBe('Loved it');
    expect(res.body.userId).toBeDefined();
    expect(res.body.likesCount).toBe(0);
    expect(res.body.commentsCount).toBe(0);
  });

  it('should return 400 when bookName is missing', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('text', 'No book name');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bookName/i);
  });

  it('should return 401 when creating without auth', async () => {
    const res = await request(app)
      .post('/posts')
      .field('bookName', 'X')
      .field('text', 'Y');
    expect(res.status).toBe(401);
  });

  it('should return 400 when create post with score below 1', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'Book')
      .field('text', 'Text')
      .field('score', '0');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/score/i);
  });

  it('should return 400 when create post with score above 5', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'Book')
      .field('text', 'Text')
      .field('score', '6');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/score/i);
  });

  it('should create post 201 with valid score 1 and 5', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res1 = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'Book One')
      .field('text', 'Text')
      .field('score', '1');
    expect(res1.status).toBe(201);
    expect(res1.body.score).toBe(1);

    const res5 = await request(app)
      .post('/posts')
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'Book Five')
      .field('text', 'Text')
      .field('score', '5');
    expect(res5.status).toBe(201);
    expect(res5.body.score).toBe(5);
  });

  it('should return 400 when update post with invalid score', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('x-test-user-id', user._id.toString())
      .field('score', '10');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/score/i);
  });

  it('should get post by id 200 with populated user', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.BOOK_TWO, userId: user._id });
    const res = await request(app).get(`/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(post._id.toString());
    expect(res.body.bookName).toBe('Book Two');
    expect(res.body.userId).toMatchObject({
      username: 'author',
      _id: user._id.toString(),
    });
  });

  it('should return 404 for nonexistent post id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/posts/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it('should update post 200 as author', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.ORIGINAL, userId: user._id });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('x-test-user-id', user._id.toString())
      .field('bookName', 'Updated Title')
      .field('text', 'Updated text');
    expect(res.status).toBe(200);
    expect(res.body.bookName).toBe('Updated Title');
    expect(res.body.text).toBe('Updated text');
  });

  it('should return 403 when updating as non-author', async () => {
    const author = await User.create(USERS.AUTHOR);
    const other = await User.create(USERS.OTHER);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: author._id });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('x-test-user-id', other._id.toString())
      .field('bookName', 'Hacked');
    expect(res.status).toBe(403);
  });

  it('should delete post 204 as author', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(204);
    const found = await Post.findById(post._id);
    expect(found).toBeNull();
  });

  it('should return 403 when deleting as non-author', async () => {
    const author = await User.create(USERS.AUTHOR);
    const other = await User.create(USERS.OTHER);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: author._id });
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set('x-test-user-id', other._id.toString());
    expect(res.status).toBe(403);
    const found = await Post.findById(post._id);
    expect(found).not.toBeNull();
  });

  it('should return 404 when deleting nonexistent post', async () => {
    const user = await User.create(USERS.AUTHOR);
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/posts/${fakeId}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(404);
  });
});

describe('Feed pagination', () => {
  it('should return feed in createdAt descending order', async () => {
    const user = await User.create(USERS.FEED);
    await Post.create({ ...POSTS.OLDER, userId: user._id });
    await Post.create({ ...POSTS.NEWER, userId: user._id });
    const res = await request(app).get('/posts?limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('posts');
    expect(res.body).toHaveProperty('total', 2);
    expect(res.body.posts).toHaveLength(2);
    expect(res.body.posts[0].bookName).toBe('Newer');
    expect(res.body.posts[1].bookName).toBe('Older');
  });

  it('should paginate feed with skip and limit', async () => {
    const user = await User.create(USERS.FEED);
    for (let i = 0; i < 5; i++) {
      await Post.create({ ...POSTS.DEFAULT, bookName: `Book ${i}`, userId: user._id });
    }
    const page1 = await request(app).get('/posts?skip=0&limit=2');
    const page2 = await request(app).get('/posts?skip=2&limit=2');
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.posts).toHaveLength(2);
    expect(page2.body.posts).toHaveLength(2);
    expect(page1.body.total).toBe(5);
    const ids1 = page1.body.posts.map((p: { _id: string }) => p._id);
    const ids2 = page2.body.posts.map((p: { _id: string }) => p._id);
    ids1.forEach((id: string) => expect(ids2).not.toContain(id));
  });

  it('should return only posts for given user', async () => {
    const userA = await User.create(USERS.FEED);
    const userB = await User.create(USERS.OTHER);
    await Post.create({ ...POSTS.A_BOOK, userId: userA._id });
    await Post.create({ ...POSTS.B_BOOK, userId: userB._id });
    const res = await request(app).get(`/posts/user/${userA._id}?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].bookName).toBe('A Book');
    expect(res.body.total).toBe(1);
  });

  it('should order user posts by createdAt descending (newest first)', async () => {
    const user = await User.create(USERS.FEED);
    await Post.create({ ...POSTS.OLDER, userId: user._id });
    await Post.create({ ...POSTS.NEWER, userId: user._id });
    const res = await request(app).get(`/posts/user/${user._id}?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(2);
    expect(res.body.posts[0].bookName).toBe('Newer');
    expect(res.body.posts[1].bookName).toBe('Older');
  });

  it('should return 400 for invalid user id on user posts', async () => {
    const res = await request(app).get('/posts/user/not-an-objectid?limit=10');
    expect(res.status).toBe(400);
  });
});

describe('Likes', () => {
  it('should like post 200 and add user to likes and increment likesCount', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app)
      .post(`/posts/${post._id}/like`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.likesCount).toBe(1);
    expect(Array.isArray(res.body.likes)).toBe(true);
    expect(res.body.likes).toHaveLength(1);
    expect(res.body.likes).toContain(user._id.toString());
  });

  it('should unlike post 200 and remove user and decrement likesCount', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id, likes: [user._id], likesCount: 1 });
    const res = await request(app)
      .post(`/posts/${post._id}/like`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.likesCount).toBe(0);
    expect(res.body.likes).toHaveLength(0);
    expect(res.body.likes).not.toContain(user._id.toString());
  });

  it('should be idempotent when liking twice (double like)', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    await request(app)
      .post(`/posts/${post._id}/like`)
      .set('x-test-user-id', user._id.toString());
    const res = await request(app)
      .post(`/posts/${post._id}/like`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.likesCount).toBe(0);
    expect(res.body.likes).toHaveLength(0);
    expect(res.body.likes).not.toContain(user._id.toString());
  });

  it('should return 401 when liking without auth', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app).post(`/posts/${post._id}/like`);
    expect(res.status).toBe(401);
  });

  it('should return 404 when liking nonexistent post', async () => {
    const user = await User.create(USERS.AUTHOR);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post(`/posts/${fakeId}/like`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(404);
  });
});
