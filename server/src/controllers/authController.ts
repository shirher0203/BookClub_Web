import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function sanitizeUser(user: unknown): Record<string, unknown> {
  const obj = user as Record<string, unknown>;
  // Ensure we never accidentally return the hashed password.
  const { password: _password, ...rest } = obj;
  return rest;
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
  const created = await User.create({
    username: usernameTrim,
    email: emailTrim,
    password: passwordHash,
  });

  // Re-fetch without password to guarantee we never return it.
  const user = await User.findById(created._id).select('-password').lean();
  res.status(201).json(user ? user : sanitizeUser(created.toObject()));
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

  const jwtSecret = getJwtSecretOrRespond(res, 'JWT_SECRET');
  if (!jwtSecret) return;
  const refreshSecret = getJwtSecretOrRespond(res, 'REFRESH_TOKEN_SECRET');
  if (!refreshSecret) return;

  const accessTtl = getTtlOrDefault('ACCESS_TOKEN_EXPIRY', '15m');
  const refreshTtl = getTtlOrDefault('REFRESH_TOKEN_EXPIRY', '7d');

  const access = parseTtlToMsAndSeconds(accessTtl);
  const refresh = parseTtlToMsAndSeconds(refreshTtl);

  const accessToken = jwt.sign(
    { id: userDoc._id.toString() },
    jwtSecret as Secret,
    { expiresIn: access.expiresIn } as SignOptions
  );
  const refreshToken = jwt.sign(
    { id: userDoc._id.toString() },
    refreshSecret as Secret,
    { expiresIn: refresh.expiresIn } as SignOptions
  );

  const expiresAt = new Date(Date.now() + refresh.ttlMs);
  await RefreshToken.create({
    token: refreshToken,
    userId: userDoc._id,
    expiresAt,
  });

  const user = await User.findById(userDoc._id).select('-password').lean();
  res.status(200).json({
    user: user ? user : sanitizeUser(userDoc.toObject()),
    accessToken,
    refreshToken,
    expiresIn: access.expiresInSeconds,
  });
}
