import { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken';
import { User } from '../models/userModel';

type AccessTokenPayload = JwtPayload & {
  userId?: string;
  id?: string;
  username?: string;
  email?: string;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export default async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    res.status(500).json({ message: 'Server misconfigured (missing JWT secret).' });
    return;
  }

  let decoded: AccessTokenPayload;
  try {
    decoded = jwt.verify(token, secret as Secret) as AccessTokenPayload;
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = decoded.userId ?? decoded.id;
  if (!id || typeof id !== 'string') {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const exists = await User.exists({ _id: id });
  if (!exists) {
    res.status(401).json({ message: 'Account no longer exists.' });
    return;
  }

  req.user = {
    id,
    username: typeof decoded.username === 'string' ? decoded.username : undefined,
    email: typeof decoded.email === 'string' ? decoded.email : undefined,
  };
  next();
}
