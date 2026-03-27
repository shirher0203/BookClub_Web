/**
 * Copy to `server.local.ts` (gitignored) for local runs: `npm run dev:local`
 * Loads `.env` via `./env` before the app.
 */
import './env';
import mongoose from 'mongoose';
import app from './app.local';

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookclub';

async function main(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  app.listen(PORT, () => {
    console.log(`Local server: http://localhost:${PORT}`);
    console.log('  GET  /api/ai/search?q=...');
    console.log('  GET  /api/search?q=...&type=all');
    console.log('  GET  /api/posts?skip=0&limit=20');
    console.log('  GET  /api/comments?postId=...');
    console.log('  GET  /uploads/... (static)');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
