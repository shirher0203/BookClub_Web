import './env';
import fs from 'fs';
import https from 'https';
import mongoose from 'mongoose';
import app from './app';

const REQUIRED_ENV = [
  'NODE_ENV',
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'ACCESS_TOKEN_EXPIRY',
  'REFRESH_TOKEN_EXPIRY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'GEMINI_API_KEY',
  'CLIENT_URL',
  'SSL_KEY_PATH',
  'SSL_CERT_PATH',
] as const;

function assertEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k]?.trim() === '');
  if (missing.length > 0) {
    console.error(`[server] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertEnv();

  const port = Number(process.env.PORT);
  if (!Number.isFinite(port) || port <= 0) {
    console.error(`[server] Invalid PORT: ${process.env.PORT ?? '(unset)'}`);
    process.exit(1);
  }

  const key = fs.readFileSync(process.env.SSL_KEY_PATH as string);
  const cert = fs.readFileSync(process.env.SSL_CERT_PATH as string);

  await mongoose.connect(process.env.MONGO_URI as string);
  console.log('[server] MongoDB connected');

  const httpsServer = https.createServer({ key, cert }, app);
  httpsServer.listen(port, () => {
    console.log(`[server] HTTPS listening on :${port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);

    const forceExit = setTimeout(() => {
      console.error('[server] Shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    httpsServer.close((httpErr) => {
      if (httpErr) console.error('[server] HTTPS close error', httpErr);
      mongoose.connection
        .close()
        .then(() => {
          console.log('[server] Shutdown complete');
          process.exit(0);
        })
        .catch((dbErr: unknown) => {
          console.error('[server] Mongo close error', dbErr);
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] Fatal startup error', err);
  process.exit(1);
});
