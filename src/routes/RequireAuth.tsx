import type { ReactNode } from 'react';
import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/user';
import { supabase } from '../lib/supabase';

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
  }, [isAdminRoute, isLoading, isResolvingRole]);

  const prevRoleRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const effectiveRole: UserRole = (profile?.role ?? user?.role) as UserRole;
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

  const [isFallbackLoading, setIsFallbackLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let alive = true;
    
    // Safety timeout: stop loading after 5 seconds no matter what
    timeoutRef.current = setTimeout(() => {
      if (alive) {
        console.warn("[RequireAuth] Loading timeout reached, forcing fallback loading to false");
        setIsFallbackLoading(false);
      }
    }, 5000);

    // Initial check
    if (!isLoading && !isResolvingRole) {
      setIsFallbackLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    // Fallback: check session directly
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) {
        console.log("[RequireAuth] Found session via fallback check");
      }
      setIsFallbackLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    });

    return () => {
      alive = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoading, isResolvingRole]);

  if ((isLoading || isResolvingRole) && isFallbackLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-sm text-gray-500 font-medium text-center">
            Initializing secure session...<br/>
            <span className="text-xs text-gray-400">This usually takes a few seconds</span>
          </p>
        </div>
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
