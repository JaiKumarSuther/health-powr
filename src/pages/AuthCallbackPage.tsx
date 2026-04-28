import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

function getReturnToFromQuery(searchParams: URLSearchParams): string | null {
  const raw =
    searchParams.get("next") ??
    searchParams.get("returnTo") ??
    searchParams.get("redirectTo");
  if (!raw) return null;
  // Only allow app-internal paths.
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const returnTo = useMemo(
    () => getReturnToFromQuery(searchParams),
    [searchParams],
  );

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setError(null);

        // If the session is already present, we're done.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          // If this tab was opened by an email link click, close it and
          // let the original tab handle the redirect
          if (window.opener && window.opener !== window) {
            try {
              window.opener.postMessage(
                { type: 'HP_AUTH_COMPLETE', success: true },
                window.location.origin
              )
              window.close()
              return
            } catch {
              // If close fails (e.g. popup blocker), continue with normal flow
            }
          }
          navigate(returnTo ?? "/", { replace: true });
          return;
        }

        // For PKCE email links, exchange the code in the URL for a session.
        // This works for signup confirmation and magic links when configured.
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
        if (exchangeError) throw exchangeError;

        // If this tab was opened by an email link click, close it and
        // let the original tab handle the redirect
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              { type: 'HP_AUTH_COMPLETE', success: true },
              window.location.origin
            )
            window.close()
            return
          } catch {
            // If close fails (e.g. popup blocker), continue with normal flow
          }
        }

        navigate(returnTo ?? "/", { replace: true });
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err?.message ||
            "Unable to complete email verification. Please try again or request a new link.",
        );
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [navigate, returnTo]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h1 className="text-lg font-bold text-gray-900">Finishing sign-in…</h1>
        <p className="text-sm text-gray-500 mt-1">
          We’re confirming your email and creating a secure session.
        </p>

        {!error ? (
          <div className="mt-5 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-teal-600" />
            <span className="text-sm font-medium text-gray-700">
              One moment…
            </span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              Verification failed
            </p>
            <p className="text-sm text-red-700/90 mt-1">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="mt-3 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

