import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  upload,
} from '../controllers/postController';

let mongoServer: MongoMemoryServer;
let app: Express;

/** Stub auth: set req.user from header x-test-user-id (tests don't depend on real auth). */
function stubAuth(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-test-user-id'] as string | undefined;
  (req as Request & { user?: { id: string } }).user = id ? { id } : undefined;
  next();
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use(stubAuth);
  app.post('/posts', upload.single('image'), createPost);
  app.get('/posts/:id', getPostById);
  app.put('/posts/:id', upload.single('image'), updatePost);
  app.delete('/posts/:id', deletePost);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Post.deleteMany({});
  await User.deleteMany({});
});

describe('Posts CRUD', () => {
  it('should create post 201 with bookName and return populated post', async () => {
    const user = await User.create({
      username: 'author1',
      email: 'a1@test.com',
      password: 'hash',
    });
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
    const user = await User.create({
      username: 'u1',
      email: 'u1@test.com',
      password: 'hash',
    });
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
    const user = await User.create({
      username: 'uScore',
      email: 'score@test.com',
      password: 'hash',
    });
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
    const user = await User.create({
      username: 'uScore2',
      email: 'score2@test.com',
      password: 'hash',
    });
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
    const user = await User.create({
      username: 'uScoreValid',
      email: 'scorevalid@test.com',
      password: 'hash',
    });
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
    const user = await User.create({
      username: 'uScoreUpdate',
      email: 'scoreup@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: user._id,
      bookName: 'Book',
      text: 'Text',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('x-test-user-id', user._id.toString())
      .field('score', '10');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/score/i);
  });

  it('should get post by id 200 with populated user', async () => {
    const user = await User.create({
      username: 'author2',
      email: 'a2@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: user._id,
      bookName: 'Book Two',
      text: 'Review',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app).get(`/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(post._id.toString());
    expect(res.body.bookName).toBe('Book Two');
    expect(res.body.userId).toMatchObject({
      username: 'author2',
      _id: user._id.toString(),
    });
  });

  it('should return 404 for nonexistent post id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/posts/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it('should update post 200 as author', async () => {
    const user = await User.create({
      username: 'author3',
      email: 'a3@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: user._id,
      bookName: 'Original',
      text: 'Original text',
      likesCount: 0,
      commentsCount: 0,
    });
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
    const author = await User.create({
      username: 'author4',
      email: 'a4@test.com',
      password: 'hash',
    });
    const other = await User.create({
      username: 'other4',
      email: 'o4@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: author._id,
      bookName: 'Author Book',
      text: 'Text',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('x-test-user-id', other._id.toString())
      .field('bookName', 'Hacked');
    expect(res.status).toBe(403);
  });

  it('should delete post 204 as author', async () => {
    const user = await User.create({
      username: 'author5',
      email: 'a5@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: user._id,
      bookName: 'To Delete',
      text: 'Text',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(204);
    const found = await Post.findById(post._id);
    expect(found).toBeNull();
  });

  it('should return 403 when deleting as non-author', async () => {
    const author = await User.create({
      username: 'author6',
      email: 'a6@test.com',
      password: 'hash',
    });
    const other = await User.create({
      username: 'other6',
      email: 'o6@test.com',
      password: 'hash',
    });
    const post = await Post.create({
      userId: author._id,
      bookName: 'Not Yours',
      text: 'Text',
      likesCount: 0,
      commentsCount: 0,
    });
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set('x-test-user-id', other._id.toString());
    expect(res.status).toBe(403);
    const found = await Post.findById(post._id);
    expect(found).not.toBeNull();
  });

  it('should return 404 when deleting nonexistent post', async () => {
    const user = await User.create({
      username: 'u7',
      email: 'u7@test.com',
      password: 'hash',
    });
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/posts/${fakeId}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(404);
  });
});
