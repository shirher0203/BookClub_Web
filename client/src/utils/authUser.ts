import type { User } from '../types';

export function getJwtExpSeconds(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
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
