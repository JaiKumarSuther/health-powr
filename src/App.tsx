import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RequireAuth } from "./routes/RequireAuth";
import { isSupabaseConfigured } from "./lib/supabase";
import { ConfigurationError } from "./components/shared/ConfigurationError";

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
  const { isLoading, isResolvingRole, retryAuth } = useAuth();
  const [loadError, setLoadError] = useState(false);

  // Track whether the app has EVER successfully loaded.
  // Once true, we never show the error screen again for background
  // token refreshes or tab-switch events.
  const hasEverLoaded = useRef(false);

  // Track whether the current loading phase is the INITIAL one
  // (page just opened) vs. a background refresh (tab switch, token renewal).
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Once loading finishes successfully, mark as loaded and flip the flag.
    if (!isLoading && !isResolvingRole) {
      hasEverLoaded.current = true;
      isInitialLoad.current = false;
      setLoadError(false);
      return;
    }

    // If we've already loaded once, this is a background refresh —
    // do NOT start any timeout, do NOT show an error screen.
    if (hasEverLoaded.current) return;

    // This is a genuine initial load — start the timeout.
    const timeout = setTimeout(() => {
      // Double-check we're still stuck (not just a brief flicker)
      if ((isLoading || isResolvingRole) && !hasEverLoaded.current) {
        setLoadError(true);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [isLoading, isResolvingRole]);

  if (!isSupabaseConfigured) {
    return <ConfigurationError />;
  }

  // Only show the error screen during the INITIAL load failure.
  // Never show it when the user is already inside the app.
  if (loadError && !hasEverLoaded.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-gray-900">Unable to load your session</p>
          <p className="text-sm text-gray-600 mt-2">
            This may be due to a connection issue or a cold start.
            Please try retrying before refreshing.
          </p>
          <div className="mt-5 flex gap-3 justify-center">
            <button
              type="button"
              onClick={async () => {
                setLoadError(false);
                await retryAuth();
              }}
              className="h-10 px-6 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-6 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show the full-screen spinner ONLY on the initial load, not on
  // background token refreshes. Once the user is inside the app,
  // any background activity happens silently.
  if ((isLoading || isResolvingRole) && !hasEverLoaded.current) {
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