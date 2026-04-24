import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/userModel';
import { RefreshToken } from '../models/tokenModel';

type RegisterBody = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type RefreshBody = {
  refreshToken?: unknown;
};

type LogoutBody = {
  refreshToken?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Plain JSON for API responses (avoids lean/BSON edge cases with res.json). */
function publicUserJson(user: {
  _id: unknown;
  username?: string;
  email?: string;
  profileImage?: string;
  googleId?: string;
  createdAt?: Date;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    _id: String(user._id),
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    profileImage: typeof user.profileImage === 'string' ? user.profileImage : '',
    createdAt: user.createdAt,
  };
  if (user.googleId != null && user.googleId !== '') {
    base.googleId = user.googleId;
  }
  return base;
}

type JwtTtl = { expiresIn: string; expiresInSeconds: number; ttlMs: number };

function parseTtlToMsAndSeconds(ttl: string): JwtTtl {
  const trimmed = ttl.trim();
  // Supports typical values like "15m" / "7d" / "3600s".
  const match = /^(\d+)\s*([smhd])$/.exec(trimmed);
  if (!match) {
    // Fallback: interpret as seconds number.
    const seconds = Number(trimmed);
    const expiresInSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const ttlMs = expiresInSeconds * 1000;
    return { expiresIn: ttl, expiresInSeconds, ttlMs };
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplierMs =
    unit === 's' ? 1000 : unit === 'm' ? 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const ttlMs = value * multiplierMs;
  const expiresInSeconds = Math.floor(ttlMs / 1000);
  return { expiresIn: trimmed, expiresInSeconds, ttlMs };
}

function getJwtSecretOrRespond(res: Response, key: 'JWT_SECRET' | 'REFRESH_TOKEN_SECRET'): string | null {
  const val = process.env[key];
  if (!val || val.trim().length === 0) {
    res.status(500).json({ message: 'Server misconfigured (missing JWT secrets).' });
    return null;
  }
  return val;
}

function getTtlOrDefault(envKey: 'ACCESS_TOKEN_EXPIRY' | 'REFRESH_TOKEN_EXPIRY', fallback: string): string {
  const val = process.env[envKey];
  return val && val.trim().length > 0 ? val.trim() : fallback;
}

function signAccessToken(
  payload: { userId: string; username?: string; email?: string },
  secret: string,
  expiresIn: string
): string {
  return jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);
}

function signRefreshToken(payload: { userId: string; jti: string }, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);
}

async function issueTokensForUser(
  res: Response,
  user: { _id: unknown; username?: string; email?: string }
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const jwtSecret = getJwtSecretOrRespond(res, 'JWT_SECRET');
  if (!jwtSecret) return null;
  const refreshSecret = getJwtSecretOrRespond(res, 'REFRESH_TOKEN_SECRET');
  if (!refreshSecret) return null;

  const accessTtl = getTtlOrDefault('ACCESS_TOKEN_EXPIRY', '15m');
  const refreshTtl = getTtlOrDefault('REFRESH_TOKEN_EXPIRY', '7d');

  const access = parseTtlToMsAndSeconds(accessTtl);
  const refresh = parseTtlToMsAndSeconds(refreshTtl);

  const userId = String(user._id);
  const accessToken = signAccessToken(
    { userId, username: user.username, email: user.email },
    jwtSecret,
    access.expiresIn
  );
  const refreshToken = signRefreshToken(
    { userId, jti: crypto.randomUUID() },
    refreshSecret,
    refresh.expiresIn
  );

  await RefreshToken.create({
    token: refreshToken,
    userId,
    expiresAt: new Date(Date.now() + refresh.ttlMs),
  });

  return { accessToken, refreshToken, expiresIn: access.expiresInSeconds };
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterBody;
  const username = body.username;
  const email = body.email;
  const password = body.password;

  if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'username, email, and password are required.' });
    return;
  }

  const usernameTrim = username.trim();
  const emailTrim = email.trim().toLowerCase();

  const existingUsername = await User.findOne({ username: usernameTrim });
  if (existingUsername) {
    res.status(400).json({ message: 'Username already exists.' });
    return;
  }

  const existingEmail = await User.findOne({ email: emailTrim });
  if (existingEmail) {
    res.status(400).json({ message: 'Email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
  const profileImage = uploadedFile ? `/uploads/profiles/${uploadedFile.filename}` : '';
  const created = await User.create({
    username: usernameTrim,
    email: emailTrim,
    password: passwordHash,
    profileImage,
  });

  // Re-fetch without password to guarantee we never return it.
  const user = await User.findById(created._id).select('-password').lean();
  const payload = user
    ? publicUserJson({
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        googleId: user.googleId,
        createdAt: user.createdAt,
      })
    : publicUserJson({
        _id: created._id,
        username: created.username,
        email: created.email,
        profileImage: created.profileImage,
        googleId: created.googleId,
        createdAt: created.createdAt,
      });
  res.status(201).json(payload);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginBody;
  const email = body.email;
  const password = body.password;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'email and password are required.' });
    return;
  }

  const emailTrim = email.trim().toLowerCase();
  const userDoc = await User.findOne({ email: emailTrim });

  // If user doesn't exist, or this is an OAuth user without stored password hash.
  if (!userDoc || !userDoc.password) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const passwordOk = await bcrypt.compare(password, userDoc.password);
  if (!passwordOk) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const tokens = await issueTokensForUser(res, userDoc);
  if (!tokens) return;

  const user = await User.findById(userDoc._id).select('-password').lean();
  const userPayload = user
    ? publicUserJson({
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        googleId: user.googleId,
        createdAt: user.createdAt,
      })
    : publicUserJson({
        _id: userDoc._id,
        username: userDoc.username,
        email: userDoc.email,
        profileImage: userDoc.profileImage,
        googleId: userDoc.googleId,
        createdAt: userDoc.createdAt,
      });

  res.status(200).json({
    user: userPayload,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const body = req.body as RefreshBody;
  const token = body.refreshToken;

  if (!isNonEmptyString(token)) {
    res.status(400).json({ message: 'refreshToken is required.' });
    return;
  }

  const tokenTrim = token.trim();
  const stored = await RefreshToken.findOne({ token: tokenTrim });
  if (!stored) {
    res.status(401).json({ message: 'Invalid refresh token.' });
    return;
  }

  const now = Date.now();
  if (stored.expiresAt.getTime() < now) {
    await stored.deleteOne();
    res.status(401).json({ message: 'Refresh token expired.' });
    return;
  }

  // Rotation: delete the used token before issuing a new one.
  await stored.deleteOne();

  const refreshSecret = getJwtSecretOrRespond(res, 'REFRESH_TOKEN_SECRET');
  if (!refreshSecret) return;
  const jwtSecret = getJwtSecretOrRespond(res, 'JWT_SECRET');
  if (!jwtSecret) return;

  let decodedUserId: string | null = null;
  try {
    const decoded = jwt.verify(tokenTrim, refreshSecret as Secret) as { userId?: unknown; id?: unknown };
    const uid = typeof decoded.userId === 'string' ? decoded.userId : typeof decoded.id === 'string' ? decoded.id : null;
    decodedUserId = uid;
  } catch {
    res.status(401).json({ message: 'Invalid refresh token.' });
    return;
  }

  if (!decodedUserId) {
    res.status(401).json({ message: 'Invalid refresh token.' });
    return;
  }

  const user = await User.findById(decodedUserId).select('username email').lean();
  if (!user) {
    res.status(401).json({ message: 'Invalid refresh token.' });
    return;
  }

  const accessTtl = getTtlOrDefault('ACCESS_TOKEN_EXPIRY', '15m');
  const refreshTtl = getTtlOrDefault('REFRESH_TOKEN_EXPIRY', '7d');
  const access = parseTtlToMsAndSeconds(accessTtl);
  const refresh = parseTtlToMsAndSeconds(refreshTtl);

  const newAccessToken = signAccessToken(
    {
      userId: decodedUserId,
      username: user.username,
      email: user.email,
    },
    jwtSecret,
    access.expiresIn
  );
  const newRefreshToken = signRefreshToken(
    { userId: decodedUserId, jti: crypto.randomUUID() },
    refreshSecret,
    refresh.expiresIn
  );

  await RefreshToken.create({
    token: newRefreshToken,
    userId: user._id,
    expiresAt: new Date(Date.now() + refresh.ttlMs),
  });

  res.status(200).json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: access.expiresInSeconds,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const body = req.body as LogoutBody;
  const token = body.refreshToken;

  if (isNonEmptyString(token)) {
    await RefreshToken.deleteOne({ token: token.trim() });
  }

  res.status(204).send();
}

export async function googleOAuthCallback(req: Request, res: Response): Promise<void> {
  // Passport attaches the full user document to req.user.
  const passportUser = (req as unknown as { user?: { _id: unknown; username?: string; email?: string } }).user;
  if (!passportUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const clientUrl = process.env.CLIENT_URL;
  if (!clientUrl || clientUrl.trim().length === 0) {
    res.status(500).json({ message: 'Server misconfigured (missing CLIENT_URL).' });
    return;
  }

  const tokens = await issueTokensForUser(res, passportUser);
  if (!tokens) return;

  const redirectTo = new URL('/oauth-success', clientUrl);
  redirectTo.searchParams.set('accessToken', tokens.accessToken);
  redirectTo.searchParams.set('refreshToken', tokens.refreshToken);
  redirectTo.searchParams.set('expiresIn', String(tokens.expiresIn));

  res.redirect(redirectTo.toString());
}
