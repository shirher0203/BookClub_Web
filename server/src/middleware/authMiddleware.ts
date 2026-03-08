import { Request, Response, NextFunction } from 'express';

/**
 * Placeholder until Developer A implements JWT verification.
 * Returns 401 so protected routes stay closed. Tests use their own stub.
 */
export default function authMiddleware(
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(401).json({ message: 'Unauthorized' });
}
