import { decodeJwtPayload } from './authUser';

/**
 * Read user id from JWT payload (no verification — UI hints only; server validates).
 */
export function getUserIdFromAccessToken(): string | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  const payload = decodeJwtPayload<{ id?: string; sub?: string; userId?: string }>(token);
  if (!payload) return null;
  return payload.id ?? payload.sub ?? payload.userId ?? null;
}
