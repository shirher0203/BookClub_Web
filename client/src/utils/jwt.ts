/**
 * Read user id from JWT payload (no verification — UI hints only; server validates).
 */
export function getUserIdFromAccessToken(): string | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1])) as { id?: string; sub?: string; userId?: string };
    return payload.id ?? payload.sub ?? payload.userId ?? null;
  } catch {
    return null;
  }
}
