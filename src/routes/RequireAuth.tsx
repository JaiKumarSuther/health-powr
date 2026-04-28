import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/user';

export function RequireAuth({
  children,
  role,
  allowedRoles
}: {
  children: ReactNode;
  role?: UserRole;
  allowedRoles?: UserRole[];
}) {
  const { user, profile, isLoading, isResolvingRole } = useAuth();
  const location = useLocation();

  if (isLoading || isResolvingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!user) {
    const isAdminRoute = role === 'admin' || allowedRoles?.includes('admin');
    if (isAdminRoute) {
      const passkeyVerified = typeof window !== 'undefined' && window.sessionStorage.getItem('hp_admin_passkey_ok') === 'true';
      return <Navigate to={passkeyVerified ? '/admin-login' : '/admin-passkey'} replace state={{ from: location }} />;
    }
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  const effectiveRole: UserRole = (profile?.role ?? user.role) as UserRole;
  const roleList = allowedRoles ?? (role ? [role] : undefined);

  // Strict role enforcement: each role can only access its own portal
  if (roleList && roleList.length > 0 && !roleList.includes(effectiveRole)) {
    // Redirect to the correct portal for their role
    if (effectiveRole === 'admin') return <Navigate to="/admin" replace />;
    if (effectiveRole === 'organization') return <Navigate to="/cbo" replace />;
    return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
}
