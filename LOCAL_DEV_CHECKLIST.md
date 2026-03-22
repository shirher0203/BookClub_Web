# Local dev — checklist (verify one by one)

Use **two terminals**: API on port **3000**, UI on **5173** (Vite proxies `/api` → 3000).

---

## 1) MongoDB is running

**Check:** In a terminal:

```bash
# macOS (Homebrew)
brew services list | grep mongodb
# or
mongosh --eval "db.runCommand({ ping: 1 })"
```

You should see `{ ok: 1 }` or a successful ping.

**If it fails:** Start MongoDB (e.g. `brew services start mongodb-community`).

---

## 1b) Optional: demo posts & comments (empty database)

**Seed sample data** (3 users, 3 posts, 5 comments — `@bookclub.demo` emails):

```bash
cd server
npm run seed
```

- Skips automatically if the DB already has **any** posts (safe).
- To **replace** only demo data: `npm run seed -- --force`

---

## 2) Server `.env` exists

**Check:** `server/.env` exists (copy from `server/.env.example` if needed).

At minimum for local dev:

- `MONGO_URI` — e.g. `mongodb://localhost:27017/bookclub` (or your real URI)
- `GEMINI_API_KEY` — only if you want **Smart Search** (`/api/ai/search`)

**If `GEMINI_API_KEY` is missing:** AI search will fail; **regular search** (`/api/search`) still works).

---

## 3) Local app files (`app.local.ts` + `server.local.ts`)

These are often **gitignored** — copy from the examples if missing:

- `server/src/app.local.example.ts` → `server/src/app.local.ts`
- `server/src/server.local.example.ts` → `server/src/server.local.ts`

**Check:** `app.local.ts` mounts **`/api/ai`**, **`/api/search`**, **`/api/posts`**, **`/api/comments`** (not `/ai` only).

**When auth & user routes exist**, add for example:

- `app.use('/api/auth', authRoute);`
- `app.use('/api/users', userRoute);`

Uncomment or add the matching `import` lines at the top of `app.local.ts`. Until those routers are implemented, you can leave them out.

---

## 4) `env` loads before the app

**Check:** `server/src/server.local.ts` starts with `import './env';` (see `server.local.example.ts`).

---

## 5) Start the API

```bash
cd server
npm run dev:local
```

**Expect:** Console prints `Local server: http://localhost:3000` and **no** Mongo connection error.

**Quick HTTP checks (optional):**

```bash
curl -s "http://localhost:3000/api/posts?skip=0&limit=5" | head -c 200
curl -s "http://localhost:3000/api/search?q=test&type=all" | head -c 200
```

You should get JSON (maybe empty `posts`/`users` arrays).

---

## 6) Start the UI

```bash
cd client
npm run dev
```

**Check:** Open **http://localhost:5173** — you should see the app (feed, navbar).

---

## Summary commands

```bash
# Terminal 1
cd server && npm run dev:local

# Terminal 2
cd client && npm run dev
```

Then open **http://localhost:5173**.
