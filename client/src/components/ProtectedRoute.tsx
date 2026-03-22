import { Navigate, useLocation } from 'react-router-dom';

export interface ProtectedRouteProps {
  children: JSX.Element;
}

/** Wraps routes that need a logged-in session (token in `localStorage`). */
export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
