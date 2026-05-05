import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
  </div>
);

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, profile, isLoading, isResolvingRole, isSubmitting } = useAuth();

  // Prevent landing/auth flicker while auth is being resolved.
  if (isLoading || isResolvingRole) {
    return <Spinner />;
  }

  if (!user || isSubmitting) {
    return <>{children}</>;
  }

  const role = profile?.role ?? user.role;
  const target =
    role === "admin" ? "/admin" :
      role === "organization" ? "/cbo" :
        "/client";

  return <Navigate to={target} replace />;
}

