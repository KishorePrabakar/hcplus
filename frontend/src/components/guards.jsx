import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.status === 'PENDING' && location.pathname !== '/awaiting-approval') {
    return <Navigate to="/awaiting-approval" replace />;
  }
  return children;
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export function PublicOnly({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <FullScreenSpinner />;
  if (user) return <Navigate to={user.status === 'PENDING' ? '/awaiting-approval' : '/'} replace />;
  return children;
}
