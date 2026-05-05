import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RequireAuth } from "./routes/RequireAuth";
import { isSupabaseConfigured } from "./lib/supabase";
import { ConfigurationError } from "./components/shared/ConfigurationError";

const LandingPage = lazy(() => import("./components/LandingPage").then(m => ({ default: m.LandingPage })));
const ClientDashboard = lazy(() => import("./components/client/ClientDashboard").then(m => ({ default: m.ClientDashboard })));
const CBODashboard = lazy(() => import("./components/cbo/CBODashboard").then(m => ({ default: m.CBODashboard })));
const StaffDashboard = lazy(() => import("./components/staff/StaffDashboard").then(m => ({ default: m.StaffDashboard })));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));

// AFTER (safe — throws clearly if neither export exists)
const AuthCallbackPage = lazy(() =>
  import("./pages/AuthCallbackPage").then(m => {
    const C = (m as any).AuthCallbackPage ?? m.default;
    if (!C) throw new Error("AuthCallbackPage: no default or named export found");
    return { default: C };
  })
);
const AdminLoginPage = lazy(() =>
  import("./pages/AdminLoginPage").then(m => {
    const C = (m as any).AdminLoginPage ?? m.default;
    if (!C) throw new Error("AdminLoginPage: no default or named export found");
    return { default: C };
  })
);
const AdminPasskeyPage = lazy(() =>
  import("./pages/AdminPasskeyPage").then(m => {
    const C = (m as any).AdminPasskeyPage ?? m.default;
    if (!C) throw new Error("AdminPasskeyPage: no default or named export found");
    return { default: C };
  })
);

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
  </div>
);

function AppRoutes() {
  const { isLoading, isResolvingRole } = useAuth();
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (isLoading || isResolvingRole) {
      const timer = setTimeout(() => {
        console.warn("[AppRoutes] Auth resolution taking too long, forcing spinner escape hatch.");
        setIsTimedOut(true);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setIsTimedOut(false);
    }
  }, [isLoading, isResolvingRole]);

  if (!isSupabaseConfigured) return <ConfigurationError />;

  const isAuthLoading = (isLoading || isResolvingRole) && !isTimedOut;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public routes - ALWAYS accessible */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/reset-password" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/admin-passkey" element={<AdminPasskeyPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        {/* Protected routes - show spinner only when loading */}
        <Route path="/client/*" element={
          isAuthLoading ? <Spinner /> :
            <RequireAuth role="community_member"><ClientDashboard /></RequireAuth>
        } />
        <Route path="/cbo/*" element={
          isAuthLoading ? <Spinner /> :
            <RequireAuth role="organization"><CBODashboard /></RequireAuth>
        } />
        <Route path="/staff/*" element={
          isAuthLoading ? <Spinner /> :
            <RequireAuth role="organization"><StaffDashboard /></RequireAuth>
        } />
        <Route path="/admin/*" element={
          isAuthLoading ? <Spinner /> :
            <RequireAuth role="admin"><AdminDashboard /></RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}