/**
 * Copy to `app.local.ts` (gitignored) for local manual testing.
 * Paths MUST match the client: axios uses baseURL `/api` → `/api/posts`, `/api/ai`, …
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import aiRoute from './routes/aiRoute';
import searchRoute from './routes/searchRoute';
import postRoute from './routes/postRoute';
import commentRoute from './routes/commentRoute';
// import authRoute from './routes/authRoute';
// import userRoute from './routes/userRoute';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../public/uploads'))
);

app.use('/api/ai', aiRoute);
app.use('/api/search', searchRoute);
app.use('/api/posts', postRoute);
app.use('/api/comments', commentRoute);
// app.use('/api/auth', authRoute);
// app.use('/api/users', userRoute);

export default app;
