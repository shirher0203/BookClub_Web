import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './OAuthSuccessPage.module.css';

export function OAuthSuccessPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { commitOAuthSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get('accessToken')?.trim() ?? '';
    const refreshToken = params.get('refreshToken')?.trim() ?? '';

    if (!accessToken || !refreshToken) {
      setError('Missing tokens from sign-in. Please try again.');
      return;
    }

    let cancelled = false;
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
  }, [params, commitOAuthSession, navigate]);

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
