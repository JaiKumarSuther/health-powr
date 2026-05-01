import type { ReactNode } from 'react';
import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/user';

type ProofVerifyResponse =
  | { valid: true; expiresAt?: number }
  | { valid?: false; error?: string }
  | null;

async function verifyAdminPasskeyProof(): Promise<boolean> {
  const proof =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('hp_admin_passkey_proof')
      : null;
  const expRaw =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('hp_admin_passkey_expires_at')
      : null;

  if (!proof || !expRaw) return false;
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp <= now) return false;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) return false;

  const res = await fetch(`${supabaseUrl}/functions/v1/verify-admin-passkey`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proof }),
  });

  const data = (await res.json().catch(() => null)) as ProofVerifyResponse;
  if (!res.ok || !data || data.valid !== true) return false;
  return true;
}

function clearAdminPasskeyProof() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('hp_admin_passkey_proof');
  window.sessionStorage.removeItem('hp_admin_passkey_expires_at');
}

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
  const isAdminRoute = role === 'admin' || allowedRoles?.includes('admin');
  const [isCheckingAdminProof, setIsCheckingAdminProof] = useState(isAdminRoute);
  const [adminProofOk, setAdminProofOk] = useState<boolean>(false);

  // Admin passkey is required for ALL admin access (even if already authenticated).
  useEffect(() => {
    if (!isAdminRoute) return;
    if (isLoading || isResolvingRole) return;
    let alive = true;
    setIsCheckingAdminProof(true);
    void verifyAdminPasskeyProof()
      .then((ok) => {
        if (!alive) return;
        setAdminProofOk(ok);
        if (!ok) clearAdminPasskeyProof();
      })
      .finally(() => {
        if (!alive) return;
        setIsCheckingAdminProof(false);
      });
    return () => {
      alive = false;
    };
  }, [isAdminRoute, isLoading, isResolvingRole, location.pathname]);

  const prevRoleRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const effectiveRole: UserRole = (profile?.role ?? user.role) as UserRole;
  const roleList = allowedRoles ?? (role ? [role] : undefined);

  useEffect(() => {
    if (!user || isLoading || isResolvingRole) return;
    
    // Strict role enforcement: each role can only access its own portal
    if (roleList && roleList.length > 0 && !roleList.includes(effectiveRole)) {
      if (effectiveRole === prevRoleRef.current) return;
      prevRoleRef.current = effectiveRole;

      // Redirect to the correct portal for their role
      if (effectiveRole === 'admin') navigate("/admin", { replace: true });
      else if (effectiveRole === 'organization') navigate("/cbo", { replace: true });
      else navigate("/client", { replace: true });
    } else {
      prevRoleRef.current = effectiveRole;
    }
  }, [effectiveRole, roleList, user, isLoading, isResolvingRole, navigate]);

  if (isLoading || isResolvingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  if (isAdminRoute && isCheckingAdminProof) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Verifying admin access…</div>
      </div>
    );
  }

  if (isAdminRoute && !adminProofOk) {
    return <Navigate to="/admin-passkey" replace state={{ from: location }} />;
  }

  if (!user) {
    if (isAdminRoute) return <Navigate to="/admin-login" replace state={{ from: location }} />;
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // If we're here, either role is allowed OR navigation is in progress from useEffect
  // We return children if allowed, otherwise we return null to avoid flicker while navigating
  if (roleList && roleList.length > 0 && !roleList.includes(effectiveRole)) {
    return null;
  }

  return <>{children}</>;
}
