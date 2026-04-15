import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/auth-context';
import { getHomePathForRole, getLoginPathForPathname } from '../lib/role-routing';
import type { Permission, Role } from '../types/domain';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { isAuthenticated, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading session...</div>;
  }

  if (!isAuthenticated) {
    const loginPath = getLoginPathForPathname(location.pathname);
    return <Navigate replace state={{ from: location }} to={loginPath} />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate replace to={getHomePathForRole(profile.role)} />;
  }

  return <Outlet />;
}

export function PermissionGate({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return <Outlet />;
}

