import express, { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../models/userModel';
import { Post } from '../../models/postModel';
import searchRoute from '../../routes/searchRoute';

let mongoServer: MongoMemoryServer;
let app: Express;

export async function initSearchTestEnv(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = express();
  app.use(express.json());
  app.use('/search', searchRoute);
}

export async function closeSearchTestEnv(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function resetSearchTestDb(): Promise<void> {
  await Post.deleteMany({});
  await User.deleteMany({});
}

export function getTestApp(): Express {
  return app;
}
