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
import { decodeJwtPayload, getJwtExpSeconds, normalizeUserFromApi } from '../utils/authUser';

const LS_ACCESS = 'accessToken';
const LS_REFRESH = 'refreshToken';
const LS_USER = 'authUser';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, profileImage?: File | null) => Promise<void>;
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

type ProfileFetchResult =
  | { kind: 'ok'; user: User }
  | { kind: 'missing' }
  | { kind: 'error' };

async function fetchUserProfileResult(userId: string): Promise<ProfileFetchResult> {
  try {
    const res = await api.get<Record<string, unknown>>(`/users/${userId}`);
    return { kind: 'ok', user: normalizeUserFromApi(res.data) };
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 401) return { kind: 'missing' };
    return { kind: 'error' };
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

      if (at) {
        const payload = decodeJwtPayload<{
          userId?: string;
          id?: string;
          sub?: string;
        }>(at);
        const uid = payload?.userId ?? payload?.id ?? payload?.sub;

        const result = uid ? await fetchUserProfileResult(uid) : ({ kind: 'missing' } as const);
        if (cancelled) return;

        if (result.kind === 'ok') {
          u = result.user;
          localStorage.setItem(LS_USER, JSON.stringify(result.user));
        } else if (result.kind === 'missing') {
          persistSession(null, null, null);
          at = null;
          u = null;
        } else {
          // Transient server error: keep the stored user (if any) so we don't nuke the session
          // for a blip. The next request that fails with 401 will still force a login.
          if (!u) {
            persistSession(null, null, null);
            at = null;
          }
        }
      }

      if (!cancelled) {
        setAccessToken(at);
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
    async (
      username: string,
      email: string,
      password: string,
      profileImage?: File | null
    ): Promise<void> => {
      if (profileImage) {
        const fd = new FormData();
        fd.append('username', username.trim());
        fd.append('email', email.trim());
        fd.append('password', password);
        fd.append('profileImage', profileImage);
        await api.post('/auth/register', fd);
      } else {
        await api.post('/auth/register', {
          username: username.trim(),
          email: email.trim(),
          password,
        });
      }
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
      const payload = decodeJwtPayload<{
        userId?: string;
        id?: string;
        sub?: string;
      }>(at);
      const uid = payload?.userId ?? payload?.id ?? payload?.sub;

      if (!uid) {
        persistSession(null, null, null);
        setUser(null);
        setAccessToken(null);
        throw new Error('Invalid OAuth token.');
      }

      localStorage.setItem(LS_ACCESS, at);
      localStorage.setItem(LS_REFRESH, rt);
      const result = await fetchUserProfileResult(uid);
      if (result.kind !== 'ok') {
        persistSession(null, null, null);
        setUser(null);
        setAccessToken(null);
        throw new Error('Could not load user for this OAuth session.');
      }
      localStorage.setItem(LS_USER, JSON.stringify(result.user));
      setUser(result.user);
      setAccessToken(at);
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
