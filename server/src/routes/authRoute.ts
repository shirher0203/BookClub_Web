import 'express-async-errors';
import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { googleOAuthCallback, login, logout, refreshToken, register } from '../controllers/authController';
import type { HydratedDocument } from 'mongoose';
import { User, type IUser } from '../models/userModel';

const router = Router();

function toPassportUser(doc: HydratedDocument<IUser>): Express.User {
  return {
    id: doc.id,
    username: doc.username,
    email: doc.email,
    _id: doc._id,
  };
}
router.use(passport.initialize());

let googleConfigured = false;

function safeUsernameFromProfile(profile: Profile, email: string): string {
  const base =
    (typeof profile.displayName === 'string' && profile.displayName.trim().length > 0
      ? profile.displayName
      : email.split('@')[0]) ?? 'member';
  return base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || 'member';
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({ username: candidate }).select('_id').lean();
    if (!exists) return candidate;
    candidate = `${base}_${String(i + 1)}`;
  }
  // last resort
  return `${base}_${Date.now()}`;
}

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  const clientID = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  const callbackURL = process.env.GOOGLE_CALLBACK_URL?.trim() ?? '';

  if (!clientID || !clientSecret || !callbackURL) {
    // Leave unconfigured; routes will respond 500.
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          if (!email) {
            done(null, false);
            return;
          }

          const byGoogle = await User.findOne({ googleId });
          if (byGoogle) {
            done(null, toPassportUser(byGoogle));
            return;
          }

          const byEmail = await User.findOne({ email });
          if (byEmail) {
            byEmail.googleId = googleId;
            await byEmail.save();
            done(null, toPassportUser(byEmail));
            return;
          }

          const base = safeUsernameFromProfile(profile, email);
          const username = await uniqueUsername(base);
          const created = await User.create({
            username,
            email,
            googleId,
            profileImage: '',
          });
          done(null, toPassportUser(created));
        } catch (e) {
          done(e as Error);
        }
      }
    )
  );

  // No sessions; keep serialize/deserialize minimal to satisfy passport types.
  passport.serializeUser((user, done) => done(null, (user as { _id?: unknown })._id ?? null));
  passport.deserializeUser((_id, done) => done(null, false));

  googleConfigured = true;
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201: { description: User created (password excluded) }
 *       400: { description: Validation error or duplicate username/email }
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and receive access + refresh tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: User + tokens }
 *       400: { description: Validation error }
 *       401: { description: Invalid credentials (or OAuth user without password) }
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh token and issue new tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New access token and new refresh token }
 *       400: { description: Missing refreshToken }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh', refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout by revoking refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       204: { description: Refresh token revoked (if present) }
 */
router.post('/logout', logout);

/**
 * @openapi
 * /auth/google:
 *   get:
 *     summary: Start Google OAuth flow
 *     tags: [Auth]
 *     responses:
 *       302: { description: Redirect to Google consent screen }
 *       500: { description: Google OAuth not configured }
 */
router.get('/google', (req, res, next) => {
  ensureGoogleConfigured();
  if (!googleConfigured) {
    res.status(500).json({ message: 'Google OAuth is not configured.' });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback (issues tokens and redirects to client)
 *     tags: [Auth]
 *     responses:
 *       302: { description: Redirect to client with tokens in query params }
 *       401: { description: OAuth failed }
 *       500: { description: Google OAuth not configured }
 */
router.get('/google/callback', (req, res, next) => {
  ensureGoogleConfigured();
  if (!googleConfigured) {
    res.status(500).json({ message: 'Google OAuth is not configured.' });
    return;
  }
  passport.authenticate('google', { session: false }, (err: unknown, user: unknown) => {
    if (err || !user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    (req as unknown as { user?: unknown }).user = user;
    void googleOAuthCallback(req, res);
  })(req, res, next);
});

export default router;
