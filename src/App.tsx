import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RequireAuth } from "./routes/RequireAuth";
import { PublicOnly } from "./routes/PublicOnly";
import { isSupabaseConfigured } from "./lib/supabase";
import { ConfigurationError } from "./components/shared/ConfigurationError";

const toLazyComponent = <T extends Record<string, unknown>>(mod: T, exportName: string, source: string) => {
  const component = (mod as any)[exportName] ?? (mod as any).default;
  if (!component) {
    throw new Error(`${source}: missing ${exportName} and default export.`);
  }
  return { default: component };
};

const LandingPage = lazy(() => import("./components/LandingPage").then(m => toLazyComponent(m, "LandingPage", "LandingPage")));
const ClientDashboard = lazy(() => import("./components/client/ClientDashboard").then(m => toLazyComponent(m, "ClientDashboard", "ClientDashboard")));
const CBODashboard = lazy(() => import("./components/cbo/CBODashboard").then(m => toLazyComponent(m, "CBODashboard", "CBODashboard")));
const StaffDashboard = lazy(() => import("./components/staff/StaffDashboard").then(m => toLazyComponent(m, "StaffDashboard", "StaffDashboard")));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard").then(m => toLazyComponent(m, "AdminDashboard", "AdminDashboard")));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => toLazyComponent(m, "AuthPage", "AuthPage")));

// AFTER (safe — throws clearly if neither export exists)
const AuthCallbackPage = lazy(() =>
  import("./pages/AuthCallbackPage").then(m => toLazyComponent(m, "AuthCallbackPage", "AuthCallbackPage"))
);
const AdminLoginPage = lazy(() =>
  import("./pages/AdminLoginPage").then(m => toLazyComponent(m, "AdminLoginPage", "AdminLoginPage"))
);
const AdminPasskeyPage = lazy(() =>
  import("./pages/AdminPasskeyPage").then(m => toLazyComponent(m, "AdminPasskeyPage", "AdminPasskeyPage"))
);

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
  </div>
);

function AppRoutes() {
  const { isLoading, isResolvingRole } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) return <ConfigurationError />;

  const isAuthLoading = isLoading || isResolvingRole;
  const isProtectedPath =
    location.pathname.startsWith("/client") ||
    location.pathname.startsWith("/cbo") ||
    location.pathname.startsWith("/staff") ||
    location.pathname.startsWith("/admin");

  if (isProtectedPath && isAuthLoading) {
    return <Spinner />;
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public routes - ALWAYS accessible */}
        <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
        <Route path="/auth" element={<PublicOnly><AuthPage /></PublicOnly>} />
        <Route path="/auth/reset-password" element={<PublicOnly><AuthPage /></PublicOnly>} />
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