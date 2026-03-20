/**
 * Copy to app.local.ts (gitignored) for local manual testing.
 * Mount paths match app integration: /api/ai, /api/search
 */
import express from 'express';
import aiRoute from './routes/aiRoute';
import searchRoute from './routes/searchRoute';

const app = express();
app.use(express.json());
app.use('/api/ai', aiRoute);
app.use('/api/search', searchRoute);

export default app;
