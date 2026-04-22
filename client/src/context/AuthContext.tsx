import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { api, setAuthTokenListener } from '../api/axios';
import type { User } from '../types';
import { getJwtExpSeconds, normalizeUserFromApi } from '../utils/authUser';

const LS_ACCESS = 'accessToken';
const LS_REFRESH = 'refreshToken';
const LS_USER = 'authUser';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  refreshTokenIfNeeded: () => Promise<boolean>;
  commitOAuthSession: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

function readStoredUser(): User | null {
  const raw = localStorage.getItem(LS_USER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeUserFromApi(parsed);
  } catch {
    return null;
  }
}

function persistSession(user: User | null, access: string | null, refresh: string | null): void {
  if (access) localStorage.setItem(LS_ACCESS, access);
  else localStorage.removeItem(LS_ACCESS);
  if (refresh) localStorage.setItem(LS_REFRESH, refresh);
  else localStorage.removeItem(LS_REFRESH);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
  else localStorage.removeItem(LS_USER);
}

function accessTokenNeedsRefresh(token: string | null, skewSec = 45): boolean {
  if (!token) return true;
  const exp = getJwtExpSeconds(token);
  if (exp == null) return false;
  return Date.now() / 1000 >= exp - skewSec;
}

async function postRefresh(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const res = await axios.post<{
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    }>(
      `${baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const { accessToken, refreshToken: nextRefresh, expiresIn } = res.data;
    if (!accessToken || !nextRefresh) return null;
    return {
      accessToken,
      refreshToken: nextRefresh,
      expiresIn: typeof expiresIn === 'number' ? expiresIn : 0,
    };
  } catch {
    return null;
  }
}

async function fetchUserProfile(userId: string): Promise<User | null> {
  try {
    const res = await api.get<Record<string, unknown>>(`/users/${userId}`);
    return normalizeUserFromApi(res.data);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const applyTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem(LS_ACCESS, access);
    localStorage.setItem(LS_REFRESH, refresh);
    setAccessToken(access);
  }, []);

  const refreshInternal = useCallback(async (): Promise<boolean> => {
    const rt = localStorage.getItem(LS_REFRESH);
    if (!rt) return false;
    const next = await postRefresh(rt);
    if (!next) {
      persistSession(null, null, null);
      setAccessToken(null);
      setUser(null);
      return false;
    }
    applyTokens(next.accessToken, next.refreshToken);
    return true;
  }, [applyTokens]);

  useEffect(() => {
    setAuthTokenListener(({ accessToken: a, refreshToken: r }) => {
      localStorage.setItem(LS_ACCESS, a);
      localStorage.setItem(LS_REFRESH, r);
      setAccessToken(a);
    });
    return () => setAuthTokenListener(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      let at = localStorage.getItem(LS_ACCESS);
      const rt = localStorage.getItem(LS_REFRESH);
      let u = readStoredUser();

      if (at && accessTokenNeedsRefresh(at)) {
        if (rt) {
          const ok = await postRefresh(rt);
          if (ok) {
            at = ok.accessToken;
            localStorage.setItem(LS_ACCESS, ok.accessToken);
            localStorage.setItem(LS_REFRESH, ok.refreshToken);
          } else {
            persistSession(null, null, null);
            at = null;
            u = null;
          }
        } else {
          persistSession(null, null, null);
          at = null;
          u = null;
        }
      } else if (!at && rt) {
        const ok = await postRefresh(rt);
        if (ok) {
          at = ok.accessToken;
          localStorage.setItem(LS_ACCESS, ok.accessToken);
          localStorage.setItem(LS_REFRESH, ok.refreshToken);
        } else {
          persistSession(null, null, null);
          u = null;
        }
      }

      if (cancelled) return;

      setAccessToken(at);

      if (at && u == null) {
        try {
          const parts = at.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1])) as {
              userId?: string;
              id?: string;
              sub?: string;
            };
            const uid = payload.userId ?? payload.id ?? payload.sub;
            if (uid) {
              const fetched = await fetchUserProfile(uid);
              if (!cancelled && fetched) {
                u = fetched;
                localStorage.setItem(LS_USER, JSON.stringify(fetched));
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) {
        setUser(u);
        setIsReady(true);
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await api.post<{
      user: Record<string, unknown>;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/auth/login', { email: email.trim(), password });

    const normalized = normalizeUserFromApi(res.data.user);
    persistSession(normalized, res.data.accessToken, res.data.refreshToken);
    setUser(normalized);
    setAccessToken(res.data.accessToken);
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string): Promise<void> => {
      await api.post('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        password,
      });
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async (): Promise<void> => {
    const rt = localStorage.getItem(LS_REFRESH);
    try {
      if (rt) {
        await api.post('/auth/logout', { refreshToken: rt });
      }
    } catch {
      // still clear client session
    }
    persistSession(null, null, null);
    setUser(null);
    setAccessToken(null);
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    return refreshInternal();
  }, [refreshInternal]);

  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    const at = localStorage.getItem(LS_ACCESS);
    if (!accessTokenNeedsRefresh(at)) return true;
    return refreshInternal();
  }, [refreshInternal]);

  const commitOAuthSession = useCallback(
    async (at: string, rt: string): Promise<void> => {
      localStorage.setItem(LS_ACCESS, at);
      localStorage.setItem(LS_REFRESH, rt);
      setAccessToken(at);

      const payload = JSON.parse(atob(at.split('.')[1])) as {
        userId?: string;
        id?: string;
        sub?: string;
        username?: string;
        email?: string;
      };
      const uid = payload.userId ?? payload.id ?? payload.sub;
      let u: User | null = null;
      if (uid) {
        u = await fetchUserProfile(uid);
      }
      if (!u && uid) {
        u = {
          id: uid,
          username: typeof payload.username === 'string' ? payload.username : 'reader',
          email: typeof payload.email === 'string' ? payload.email : '',
          createdAt: '',
        };
      }
      if (u) {
        localStorage.setItem(LS_USER, JSON.stringify(u));
        setUser(u);
      } else {
        localStorage.removeItem(LS_USER);
        setUser(null);
      }
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isReady,
      isAuthenticated: Boolean(accessToken),
      login,
      register,
      logout,
      refresh,
      refreshTokenIfNeeded,
      commitOAuthSession,
      setUser,
    }),
    [
      user,
      accessToken,
      isReady,
      login,
      register,
      logout,
      refresh,
      refreshTokenIfNeeded,
      commitOAuthSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
