import type { User } from '../types';

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) return null;
    return JSON.parse(atob(b64)) as T;
  } catch {
    return null;
  }
}

export function getJwtExpSeconds(token: string): number | null {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload && typeof payload.exp === 'number' ? payload.exp : null;
}

export function normalizeUserFromApi(raw: Record<string, unknown>): User {
  const id =
    raw._id != null
      ? String(raw._id)
      : raw.id != null
        ? String(raw.id)
        : '';
  return {
    id,
    username: String(raw.username ?? ''),
    email: String(raw.email ?? ''),
    profileImage: raw.profileImage != null ? String(raw.profileImage) : undefined,
    createdAt:
      raw.createdAt != null
        ? typeof raw.createdAt === 'string'
          ? raw.createdAt
          : new Date(raw.createdAt as string | number | Date).toISOString()
        : '',
  };
}
