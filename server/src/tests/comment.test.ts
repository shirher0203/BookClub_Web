import request from 'supertest';
import { User } from '../models/userModel';
import { Post } from '../models/postModel';
import { Comment } from '../models/commentModel';
import {
  initCommentTestEnv,
  closeCommentTestEnv,
  resetCommentTestDb,
  getTestApp,
  USERS,
  POSTS,
  COMMENTS,
} from './helpers/commentTestHelpers';

let app: ReturnType<typeof getTestApp>;

beforeAll(async () => {
  await initCommentTestEnv();
  app = getTestApp();
});

afterAll(async () => {
  await closeCommentTestEnv();
});

beforeEach(async () => {
  await resetCommentTestDb();
});

describe('Comments', () => {
  it('should create comment 201 and increment post commentsCount', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app)
      .post('/comments')
      .set('x-test-user-id', user._id.toString())
      .send({ postId: post._id.toString(), text: COMMENTS.DEFAULT.text });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.postId).toBe(post._id.toString());
    expect(res.body.text).toBe(COMMENTS.DEFAULT.text);
    const updatedPost = await Post.findById(post._id).lean();
    expect(updatedPost?.commentsCount).toBe(1);
  });

  it('should return 401 when creating comment without auth', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const res = await request(app)
      .post('/comments')
      .send({ postId: post._id.toString(), text: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when postId or text is missing', async () => {
    const user = await User.create(USERS.AUTHOR);
    const res = await request(app)
      .post('/comments')
      .set('x-test-user-id', user._id.toString())
      .send({ text: 'Only text' });
    expect(res.status).toBe(400);
  });

  it('should return 404 when post does not exist', async () => {
    const user = await User.create(USERS.AUTHOR);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post('/comments')
      .set('x-test-user-id', user._id.toString())
      .send({ postId: fakeId, text: 'Hi' });
    expect(res.status).toBe(404);
  });

  it('should get comments by postId 200 sorted by createdAt', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    await Comment.create([
      { postId: post._id, userId: user._id, text: 'First', createdAt: new Date('2024-01-01T10:00:00Z') },
      { postId: post._id, userId: user._id, text: 'Second', createdAt: new Date('2024-01-01T11:00:00Z') },
    ]);
    const res = await request(app).get(`/comments?postId=${post._id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].text).toBe('First');
    expect(res.body[1].text).toBe('Second');
  });

  it('should return 400 when get comments without postId', async () => {
    const res = await request(app).get('/comments');
    expect(res.status).toBe(400);
  });

  it('should get comments 200 without auth', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    await Comment.create({ postId: post._id, userId: user._id, text: 'Public comment' });
    const res = await request(app).get(`/comments?postId=${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toBe('Public comment');
  });

  it('should delete comment 204 and decrement post commentsCount', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id, commentsCount: 1 });
    const comment = await Comment.create({
      postId: post._id,
      userId: user._id,
      text: COMMENTS.DEFAULT.text,
    });
    const res = await request(app)
      .delete(`/comments/${comment._id}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(204);
    const updatedPost = await Post.findById(post._id).lean();
    expect(updatedPost?.commentsCount).toBe(0);
    const deleted = await Comment.findById(comment._id);
    expect(deleted).toBeNull();
  });

  it('should return 403 when deleting comment as non-author', async () => {
    const author = await User.create(USERS.AUTHOR);
    const other = await User.create(USERS.OTHER);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: author._id });
    const comment = await Comment.create({
      postId: post._id,
      userId: author._id,
      text: COMMENTS.DEFAULT.text,
    });
    const res = await request(app)
      .delete(`/comments/${comment._id}`)
      .set('x-test-user-id', other._id.toString());
    expect(res.status).toBe(403);
  });

  it('should return 404 when deleting nonexistent comment', async () => {
    const user = await User.create(USERS.AUTHOR);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .delete(`/comments/${fakeId}`)
      .set('x-test-user-id', user._id.toString());
    expect(res.status).toBe(404);
  });

  it('should return 401 when deleting comment without auth', async () => {
    const user = await User.create(USERS.AUTHOR);
    const post = await Post.create({ ...POSTS.DEFAULT, userId: user._id });
    const comment = await Comment.create({
      postId: post._id,
      userId: user._id,
      text: COMMENTS.DEFAULT.text,
    });
    const res = await request(app).delete(`/comments/${comment._id}`);
    expect(res.status).toBe(401);
  });
});
