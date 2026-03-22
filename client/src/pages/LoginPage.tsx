import { Link } from 'react-router-dom';
import styles from './LoginPage.module.css';

/** Shown when visiting a protected route without a session token. */
export function LoginPage(): JSX.Element {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.accent} aria-hidden />
        <p className={styles.message}>You need to sign in for this page.</p>
        <div className={styles.buttons}>
          <Link to="/login" className={styles.btnPrimary}>
            Sign in
          </Link>
          <Link to="/feed" className={styles.btnSecondary}>
            Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}
