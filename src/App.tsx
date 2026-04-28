import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RequireAuth } from "./routes/RequireAuth";

const LandingPage = lazy(() =>
  import("./components/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const ClientDashboard = lazy(() =>
  import("./components/client/ClientDashboard").then((m) => ({
    default: m.ClientDashboard,
  })),
);
const CBODashboard = lazy(() =>
  import("./components/cbo/CBODashboard").then((m) => ({ default: m.CBODashboard })),
);
const StaffDashboard = lazy(() =>
  import("./components/staff/StaffDashboard").then((m) => ({ default: m.StaffDashboard })),
);
const AdminDashboard = lazy(() =>
  import("./components/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const AdminLoginPage = lazy(() =>
  import("./pages/AdminLoginPage").then((m) => ({ default: (m as any).AdminLoginPage || m.default })),
);
const AdminPasskeyPage = lazy(() =>
  import("./pages/AdminPasskeyPage").then((m) => ({ default: (m as any).AdminPasskeyPage || m.default })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })),
);
const AuthCallbackPage = lazy(() =>
  import("./pages/AuthCallbackPage").then((m) => ({ default: (m as any).AuthCallbackPage || m.default })),
);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppRoutes() {
  const { isLoading, isResolvingRole } = useAuth();

  // Block ALL routing until we have a confirmed role from the DB.
  // This prevents any portal flash while profile is being fetched.
  if (isLoading || isResolvingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/reset-password" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/admin-passkey" element={<AdminPasskeyPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route
          path="/client/*"
          element={
            <RequireAuth role="community_member">
              <ClientDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/cbo/*"
          element={
            <RequireAuth role="organization">
              <CBODashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/staff/*"
          element={
            <RequireAuth role="organization">
              <StaffDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireAuth role="admin">
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <div className="hp-page">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
