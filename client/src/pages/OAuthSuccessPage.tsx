import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './OAuthSuccessPage.module.css';

export function OAuthSuccessPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { commitOAuthSession, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get('accessToken')?.trim() ?? '';
    const refreshToken = params.get('refreshToken')?.trim() ?? '';

    let cancelled = false;

    if (!accessToken || !refreshToken) {
      void (async () => {
        try {
          await logout();
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          navigate('/login?error=oauth_failed', { replace: true });
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        await commitOAuthSession(accessToken, refreshToken);
        if (!cancelled) navigate('/feed', { replace: true });
      } catch {
        if (!cancelled) setError('Could not complete sign-in.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, commitOAuthSession, logout, navigate]);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error} role="alert">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden />
        <h1 className={styles.title}>Signing you in…</h1>
        <p className={styles.text}>Taking you to your shelf.</p>
      </div>
    </div>
  );
}
