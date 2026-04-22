/**
 * Copy to `app.local.ts` (gitignored) for local manual testing.
 * Paths MUST match the client: axios uses baseURL `/api` → `/api/posts`, `/api/ai`, …
 */
import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import cors from 'cors';
import aiRoute from './routes/aiRoute';
import searchRoute from './routes/searchRoute';
import postRoute from './routes/postRoute';
import commentRoute from './routes/commentRoute';
import authRoute from './routes/authRoute';
import userRoute from './routes/userRoute';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const serverRoot = path.resolve(__dirname, __dirname.includes(`${path.sep}dist${path.sep}`) ? '../..' : '..');
app.use('/uploads', express.static(path.join(serverRoot, 'public/uploads')));

app.use('/api/ai', aiRoute);
app.use('/api/search', searchRoute);
app.use('/api/posts', postRoute);
app.use('/api/comments', commentRoute);
app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ message });
});

export default app;
