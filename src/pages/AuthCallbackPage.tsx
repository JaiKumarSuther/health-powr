import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

function getReturnToFromQuery(searchParams: URLSearchParams): string | null {
  const raw =
    searchParams.get("next") ??
    searchParams.get("returnTo") ??
    searchParams.get("redirectTo");
  if (!raw) return null;
  const allowed = new Set(["/client", "/cbo", "/staff", "/admin"]);
  const trimmed = raw.trim();
  if (!allowed.has(trimmed)) return null;
  return trimmed;
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const hadReturnToParam = useMemo(() => {
    const raw =
      searchParams.get("next") ??
      searchParams.get("returnTo") ??
      searchParams.get("redirectTo");
    return !!raw;
  }, [searchParams]);

  const returnTo = useMemo(
    () => getReturnToFromQuery(searchParams),
    [searchParams],
  );

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setError(null);

        // Check for error params in the URL hash (implicit-flow redirects).
        // e.g. #error=access_denied&error_code=otp_expired&error_description=...
        const hash = window.location.hash.slice(1); // strip leading '#'
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const hashError = hashParams.get("error");
          const hashErrorCode = hashParams.get("error_code");
          const hashErrorDesc = hashParams.get("error_description");
          if (hashError) {
            const isExpired =
              hashErrorCode === "otp_expired" ||
              hashErrorDesc?.toLowerCase().includes("expired") ||
              hashErrorDesc?.toLowerCase().includes("invalid");
            throw new Error(
              isExpired
                ? "Your email confirmation link has expired or is no longer valid. Please go back and sign up again to receive a new link."
                : hashErrorDesc?.replace(/\+/g, " ") ||
                    "Verification failed. Please try again.",
            );
          }
        }

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
          navigate(returnTo ?? (hadReturnToParam ? "/" : "/client"), { replace: true });
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

        navigate(returnTo ?? (hadReturnToParam ? "/" : "/client"), { replace: true });
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
  }, [navigate, returnTo, hadReturnToParam]);

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
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/auth?mode=signup", { replace: true })}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

