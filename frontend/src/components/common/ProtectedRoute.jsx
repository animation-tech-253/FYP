import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  selectIsAuthenticated,
  selectUserRole,
  selectInitialized,
} from '../../store/slices/authSlice';
import { getDashboardPath } from '../../utils/routeHelpers';

// ─── Full-page loading spinner ────────────────────────────────────────────────
const InitLoader = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-obsidian-850 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-slate-400 dark:text-slate-500 text-sm">Loading SUATS...</p>
    </div>
  </div>
);

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Blocks render until auth is confirmed. Redirects unauthenticated users to /login.
export const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const initialized     = useSelector(selectInitialized);
  const location        = useLocation();

  if (!initialized)     return <InitLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

// ─── PublicRoute ──────────────────────────────────────────────────────────────
// Shows spinner while initializing (prevents flash + crash).
// Once initialized, redirects authenticated users to their dashboard.
// Unauthenticated users (or still-loading) just see the page (login/register).
export const PublicRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const initialized     = useSelector(selectInitialized);
  const user            = useSelector((state) => state.auth.user);

  // Still checking cookie/session — show loader so nothing renders prematurely
  if (!initialized) return <InitLoader />;

  // Already logged in → send to their dashboard
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
};

// ─── RoleRoute ────────────────────────────────────────────────────────────────
// Must be used INSIDE a <ProtectedRoute> shell. Checks role after auth is confirmed.
export const RoleRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const role            = useSelector(selectUserRole);
  const initialized     = useSelector(selectInitialized);

  if (!initialized)                    return <InitLoader />;
  if (!isAuthenticated)                return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role))    return <Navigate to="/unauthorized" replace />;
  return children;
};

// ─── StudentOnlyRoute ─────────────────────────────────────────────────────────
// Used specifically for /register — only students can self-register.
// Admin creates staff accounts; staff/admin only need login.
export const StudentOnlyRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const initialized     = useSelector(selectInitialized);
  const user            = useSelector((state) => state.auth.user);

  if (!initialized) return <InitLoader />;

  // If already logged in, send to dashboard (no reason to be on register)
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
};