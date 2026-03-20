import express, { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Post } from '../../models/postModel';
import { User } from '../../models/userModel';
import aiRoute from '../../routes/aiRoute';

let mongoServer: MongoMemoryServer;
let app: Express;

export async function initAiTestEnv(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use('/ai', aiRoute);
}

export async function closeAiTestEnv(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function resetAiTestDb(): Promise<void> {
  await Post.deleteMany({});
  await User.deleteMany({});
}

export function getTestApp(): Express {
  return app;
}
