import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../models/userModel';
import { Post } from '../../models/postModel';
import {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
  upload,
} from '../../controllers/postController';

/** User definition (no _id; used with User.create). */
export interface UserDef {
  username: string;
  email: string;
  password: string;
}

/** Post definition without userId (userId added at test time). */
export interface PostDef {
  bookName: string;
  text: string;
  likesCount: number;
  commentsCount: number;
  createdAt?: Date;
}

export const USERS: Record<string, UserDef> = {
  AUTHOR: { username: 'author', email: 'author@test.com', password: 'hash' },
  OTHER: { username: 'other', email: 'other@test.com', password: 'hash' },
  FEED: { username: 'feed', email: 'feed@test.com', password: 'hash' },
};

export const POSTS: Record<string, PostDef> = {
  DEFAULT: { bookName: 'Test Book', text: 'Test review', likesCount: 0, commentsCount: 0 },
  BOOK_TWO: { bookName: 'Book Two', text: 'Review', likesCount: 0, commentsCount: 0 },
  ORIGINAL: { bookName: 'Original', text: 'Original text', likesCount: 0, commentsCount: 0 },
  OLDER: {
    bookName: 'Older',
    text: 'First',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date('2024-01-01'),
  },
  NEWER: {
    bookName: 'Newer',
    text: 'Second',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date('2024-06-01'),
  },
  A_BOOK: { bookName: 'A Book', text: 'A', likesCount: 0, commentsCount: 0 },
  B_BOOK: { bookName: 'B Book', text: 'B', likesCount: 0, commentsCount: 0 },
};

let mongoServer: MongoMemoryServer;
let app: Express;

/** Stub auth: set req.user from header x-test-user-id (tests don't depend on real auth). */
export function stubAuth(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-test-user-id'] as string | undefined;
  (req as Request & { user?: { id: string } }).user = id ? { id } : undefined;
  next();
}

export async function initPostTestEnv(): Promise<void> {
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
  app.post('/posts/:id/like', toggleLike);
}

export async function closePostTestEnv(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function resetPostTestDb(): Promise<void> {
  await Post.deleteMany({});
  await User.deleteMany({});
}

export function getTestApp(): Express {
  return app;
}
