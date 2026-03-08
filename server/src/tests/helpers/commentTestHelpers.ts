import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../models/userModel';
import { Post } from '../../models/postModel';
import { Comment } from '../../models/commentModel';
import {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  upload,
} from '../../controllers/postController';
import {
  createComment,
  getCommentsByPostId,
  deleteComment,
} from '../../controllers/commentController';
import { USERS, POSTS } from './postTestHelpers';

export { USERS, POSTS };

/** Comment definition (postId and userId set at test time). */
export interface CommentDef {
  text: string;
}

export const COMMENTS: Record<string, CommentDef> = {
  DEFAULT: { text: 'A comment' },
  SECOND: { text: 'Another comment' },
};

let mongoServer: MongoMemoryServer;
let app: Express;

/** Stub auth: set req.user from header x-test-user-id (tests don't depend on real auth). */
export function stubAuth(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-test-user-id'] as string | undefined;
  (req as Request & { user?: { id: string } }).user = id ? { id } : undefined;
  next();
}

export async function initCommentTestEnv(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use(stubAuth);
  app.post('/posts', upload.single('image'), createPost);
  app.get('/posts', getFeed);
  app.get('/posts/user/:id', getUserPosts);
  app.get('/posts/:id', getPostById);
  app.put('/posts/:id', upload.single('image'), updatePost);
  app.delete('/posts/:id', deletePost);
  app.post('/comments', createComment);
  app.get('/comments', getCommentsByPostId);
  app.delete('/comments/:id', deleteComment);
}

export async function closeCommentTestEnv(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function resetCommentTestDb(): Promise<void> {
  await Comment.deleteMany({});
  await Post.deleteMany({});
  await User.deleteMany({});
}

export function getTestApp(): Express {
  return app;
}
