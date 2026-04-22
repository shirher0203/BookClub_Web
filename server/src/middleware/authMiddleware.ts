import { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken';

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

export default function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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

  try {
    const decoded = jwt.verify(token, secret as Secret) as AccessTokenPayload;
    const id = decoded.userId ?? decoded.id;
    if (!id || typeof id !== 'string') {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    req.user = {
      id,
      username: typeof decoded.username === 'string' ? decoded.username : undefined,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}
