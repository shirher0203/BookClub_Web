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
 *
 * `exec_mode: 'fork'` is required for this app:
 *   - We only need a single instance, and fork mode is the simpler model.
 *   - Cluster mode forks workers through PM2's internal master process, which
 *     does not inherit Node's `cap_net_bind_service` capability. On node75
 *     that surfaced as `Error: bind EACCES null:443` even though `node` itself
 *     had the capability set via `setcap`. Fork mode `exec`s the script
 *     directly, so the capability applies and binding :443 succeeds.
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
      exec_mode: 'fork',
    },
  ],
};
