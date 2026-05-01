import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RequireAuth } from "./routes/RequireAuth";
import { isSupabaseConfigured } from "./lib/supabase";
import { ConfigurationError } from "./components/shared/ConfigurationError";

// ── Lazy imports — all use .then() to safely handle named exports ──
const LandingPage = lazy(() => import("./components/LandingPage").then(m => ({ default: m.LandingPage })));
const ClientDashboard = lazy(() => import("./components/client/ClientDashboard").then(m => ({ default: m.ClientDashboard })));
const CBODashboard = lazy(() => import("./components/cbo/CBODashboard").then(m => ({ default: m.CBODashboard })));
const StaffDashboard = lazy(() => import("./components/staff/StaffDashboard").then(m => ({ default: m.StaffDashboard })));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage").then(m => ({ default: (m as any).AuthCallbackPage ?? m.default })));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage").then(m => ({ default: (m as any).AdminLoginPage ?? m.default })));
const AdminPasskeyPage = lazy(() => import("./pages/AdminPasskeyPage").then(m => ({ default: (m as any).AdminPasskeyPage ?? m.default })));

// ── Simple spinner ──
const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
  </div>
);

function AppRoutes() {
  const { isLoading, isResolvingRole } = useAuth();

  if (!isSupabaseConfigured) return <ConfigurationError />;

  // Block routing only on the very first load until we know who the user is.
  // After that, any background token refresh happens silently.
  if (isLoading || isResolvingRole) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/reset-password" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/admin-passkey" element={<AdminPasskeyPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        <Route path="/client/*" element={
          <RequireAuth role="community_member"><ClientDashboard /></RequireAuth>
        } />
        <Route path="/cbo/*" element={
          <RequireAuth role="organization"><CBODashboard /></RequireAuth>
        } />
        <Route path="/staff/*" element={
          <RequireAuth role="organization"><StaffDashboard /></RequireAuth>
        } />
        <Route path="/admin/*" element={
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