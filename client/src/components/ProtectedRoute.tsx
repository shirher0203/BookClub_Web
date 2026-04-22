import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ProtectedRoute.module.css';

export interface ProtectedRouteProps {
  children: JSX.Element;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <div className={styles.boot} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden />
        <span>Opening the book…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
