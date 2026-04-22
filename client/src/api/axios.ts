import axios from 'axios';

/**
 * Default `/api` works when the SPA and API share the same origin (Vite proxy in dev,
 * reverse proxy / same server in prod). Override for split deployments.
 */
const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

type TokenListener = ((tokens: { accessToken: string; refreshToken: string }) => void) | null;

let tokenListener: TokenListener = null;

export function setAuthTokenListener(fn: TokenListener): void {
  tokenListener = fn;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

function redirectToLogin(): void {
  if (window.location.pathname === '/login' || window.location.pathname === '/register') {
    return;
  }
  window.location.assign('/login');
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) return null;
  try {
    const res = await axios.post<{
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    }>(
      `${baseURL}/auth/refresh`,
      { refreshToken: refresh },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const nextAccess = res.data.accessToken;
    const nextRefresh = res.data.refreshToken;
    if (!nextAccess || !nextRefresh) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      return null;
    }
    localStorage.setItem('accessToken', nextAccess);
    localStorage.setItem('refreshToken', nextRefresh);
    tokenListener?.({ accessToken: nextAccess, refreshToken: nextRefresh });
    return nextAccess;
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    return null;
  }
}

function shouldSkipAuthRetry(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    if (!original) return Promise.reject(error);

    const reqUrl = typeof original.url === 'string' ? original.url : '';
    if (shouldSkipAuthRetry(reqUrl)) {
      return Promise.reject(error);
    }

    original._retry = true;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    redirectToLogin();
    return Promise.reject(error);
  }
);
