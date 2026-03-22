import { Request, Response, NextFunction } from 'express';

/**
 * Stub: returns 401 until JWT verification is wired here.
 * Tests may replace this via a test-only middleware or headers.
 */
export default function authMiddleware(
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(401).json({ message: 'Unauthorized' });
}
