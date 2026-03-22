/**
 * Image paths from API are like `/uploads/posts/...` (same origin as API server).
 * Vite only proxies `/api`; static uploads are served from the API origin.
 */
export function assetUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin =
    import.meta.env.VITE_ASSET_ORIGIN ??
    (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
