/*
 * PM2 config for BookClub (production).
 *
 * The server loads its own .env at runtime via `src/env.ts` (dotenv), so
 * `env_file` is intentionally NOT set here. PM2 does NOT auto-pick up changes
 * to `.env` — if you edit `server/.env` on the production server you MUST run:
 *
 *     pm2 reload bookclub-api --update-env
 *
 * A plain `pm2 restart bookclub-api` keeps the previously-cached env and your
 * edits will silently not take effect.
 *
 * The `env` block below is the minimal thing PM2 itself injects:
 *   - NODE_ENV=production (required by the project spec and by `server.ts`'s
 *     boot-time env validation).
 *
 * `script` points to the TypeScript build output of `src/server.ts`. With
 * `rootDir: "."` and `outDir: "./dist"` in `tsconfig.json`, the compiled file
 * is `dist/src/server.js`, not `dist/server.js`.
 */
module.exports = {
  apps: [
    {
      name: 'bookclub-api',
      script: 'dist/src/server.js',
      cwd: '.',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
    },
  ],
};
