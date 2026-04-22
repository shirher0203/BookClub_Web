/**
 * Full URL to start Google OAuth (full-page navigation).
 * Matches axios `baseURL`: `VITE_API_URL` if absolute, else `/api` on `window.location.origin`.
 */
export function getGoogleOAuthStartUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    const base = raw.replace(/\/$/, '');
    return `${base}/auth/google`;
  }
  const prefix =
    raw && raw.startsWith('/') ? (raw.replace(/\/$/, '') || '/api') : '/api';
  return `${window.location.origin}${prefix}/auth/google`;
}
