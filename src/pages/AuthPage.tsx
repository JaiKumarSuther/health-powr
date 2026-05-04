import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  User, Building2, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, Loader2, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { BrandMark } from "../components/landing/BrandMark";
import { useAuth } from "../contexts/AuthContext";

type Mode = "signin" | "signup" | "forgot";
type ForgotStep = "request" | "verify" | "reset";

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signUp, user, profile, isResolvingRole } = useAuth();

  const mode = (searchParams.get("mode") as Mode) ?? "signin";
  const [role, setRole] = useState<"community_member" | "organization">("community_member");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [borough, setBorough] = useState("Manhattan");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Forgot password
  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // ── Redirect once user is authenticated ─────────────────────────
  useEffect(() => {
    // Wait until auth initialization is complete
    if (isResolvingRole) return;

    // Auth resolved — clear any lingering local loading state
    setLoading(false);

    if (!user) return;

    // Prefer DB profile role; fall back to JWT metadata role (for new users
    // whose profile row hasn't been created yet by the DB trigger).
    const resolvedRole = profile?.role ?? user.role;

    const dest =
      resolvedRole === "admin" ? "/admin" :
        resolvedRole === "organization" ? "/cbo" : "/client";

    console.log("[AuthPage] Auth resolved, navigating to:", dest, { profileRole: profile?.role, userRole: user.role });
    setTimeout(() => {
      navigate(dest, { replace: true });
    }, 100);
  }, [user, profile, isResolvingRole, navigate]);

  // ── Resend countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Handle password-reset deep link ──────────────────────────────
  useEffect(() => {
    if (location.pathname === "/auth/reset-password") {
      setSearchParams({ mode: "forgot" });
      setForgotStep("reset");
    }
  }, [location.pathname]);

  // ── Helpers ──────────────────────────────────────────────────────
  const goMode = (m: Mode) => {
    setSearchParams({ mode: m });
    setError(null);
    setForgotStep("request");
    setOtp(""); setNewPw(""); setConfirmPw("");
  };

  // ── Handlers ─────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!email || !password) return setError("Please enter email and password.");
    setLoading(true); setError(null);
    try {
      await signIn({ email, password });
      // We do NOT call navigate here.
      // The useEffect above will handle redirection once the AuthContext updates.
      // If we are successful, the component will eventually unmount.
    } catch (e: any) {
      console.error("[AuthPage] Sign in failed:", e);
      setError(
        e.message.includes("Invalid login") || e.message.includes("invalid_credentials")
          ? "Incorrect email or password."
          : e.message
      );
      setLoading(false); // Only set loading to false on error so spinner keeps going on success until redirect
    }
  }

  async function handleSignUp() {
    if (!email || !password || !fullName) return setError("Please fill in all required fields.");
    setLoading(true); setError(null);
    try {
      await signUp({
        email, password, name: fullName,
        role,
        organization: role === "organization" ? orgName : undefined,
        borough: role === "organization" ? borough : undefined,
      });
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message.includes("already") ? "An account with this email already exists." : e.message);
    } finally { setLoading(false); }
  }

  async function handleSendReset() {
    if (!email) return setError("Please enter your email address.");
    setLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email);
      if (e) throw e;
      setForgotStep("verify"); setResendTimer(60);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return setError("Please enter the 6-digit code.");
    setLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
      if (e) throw e;
      setForgotStep("reset");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleUpdatePw() {
    if (newPw !== confirmPw || newPw.length < 8) return;
    setLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPw });
      if (e) throw e;
      goMode("signin");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Shared styles ─────────────────────────────────────────────────
  const input = "w-full rounded-xl border border-slate-200 py-3 text-sm placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
  const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const btn = "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-50";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ── Left panel (desktop only) — purely static ── */}
      <div className="hidden w-1/2 flex-shrink-0 flex-col bg-emerald-950 text-white md:flex">
        <div className="px-12 pt-12 cursor-pointer" onClick={() => navigate("/")}>
          <div className="flex items-center gap-2">
            <BrandMark className="h-10 w-10" />
            <span className="text-xl font-bold">HealthPowr</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center px-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
            Trusted by NYC communities
          </p>
          <h2 className="mb-4 text-4xl font-extrabold leading-tight">
            Real people.<br />Real support.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-white/60">
            Connect with 200+ verified community organizations across New York
            City — housing, food, healthcare, and more.
          </p>
        </div>
        <div className="px-12 pb-12">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="mb-4 text-sm leading-relaxed text-white/80">
              "I found food assistance for my family within the same afternoon.
              The caseworker responded in under 3 hours."
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold">M</div>
              <div>
                <p className="text-xs font-semibold">Maria R.</p>
                <p className="text-xs text-white/50">Mott Haven, Bronx</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex w-full flex-col overflow-y-auto md:w-1/2">

        {/* Back to home */}
        <div className="px-8 pt-6 md:px-16 md:pt-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-xs font-bold text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </button>
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 md:px-16">
          <div className="w-full max-w-[400px]">

            {/* Mobile logo */}
            <div className="mb-8 flex cursor-pointer items-center gap-2 md:hidden" onClick={() => navigate("/")}>
              <BrandMark className="h-8 w-8" />
              <span className="text-lg font-bold text-slate-900">HealthPowr</span>
            </div>

            {/* ── Email confirmed screen ── */}
            {confirmed ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                  <Mail className="h-7 w-7 text-teal-600" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Check your email</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  We sent a confirmation link to <strong>{email}</strong>.
                  Click it to activate your account.
                </p>
                <button onClick={() => navigate("/")} className="mt-6 text-sm font-semibold text-teal-600 hover:text-teal-700">
                  ← Back to HealthPowr
                </button>
              </div>
            ) : (
              <>
                {/* Sign in / Create account tabs — only show for signin/signup */}
                {mode !== "forgot" && (
                  <div className="mb-8 flex w-full rounded-xl bg-slate-100 p-1">
                    {(["signin", "signup"] as const).map(m => (
                      <button key={m} onClick={() => goMode(m)}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}>
                        {m === "signin" ? "Sign in" : "Create account"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Error banner */}
                {error && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-sm font-medium text-red-600">{error}</p>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.div key={mode + forgotStep}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>

                    {/* ════ SIGN IN ════ */}
                    {mode === "signin" && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <h1 className="text-2xl font-extrabold text-slate-900">Welcome back</h1>
                          <p className="mt-1 text-sm text-slate-400">Sign in to your HealthPowr account.</p>
                        </div>

                        <div>
                          <label className={label}>Email address</label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleSignIn()}
                              placeholder="your@email.com" className={`${input} pl-10 pr-4`} />
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                            <button type="button" onClick={() => goMode("forgot")}
                              className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type={showPw ? "text" : "password"} value={password}
                              onChange={e => setPassword(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleSignIn()}
                              placeholder="••••••••" className={`${input} pl-10 pr-11`} />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <button onClick={handleSignIn} disabled={loading} className={btn}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      </div>
                    )}

                    {/* ════ SIGN UP ════ */}
                    {mode === "signup" && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <h1 className="text-2xl font-extrabold text-slate-900">Create an account</h1>
                          <p className="mt-1 text-sm text-slate-400">Join our community and get support.</p>
                        </div>

                        {/* Client / Provider toggle */}
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "community_member", label: "Client", Icon: User },
                            { id: "organization", label: "Provider", Icon: Building2 },
                          ] as const).map(({ id, label: lbl, Icon }) => (
                            <button key={id} type="button" onClick={() => setRole(id)}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-semibold transition-colors ${role === id
                                ? "border-teal-500 bg-teal-50 text-teal-700"
                                : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}>
                              <Icon className="h-4 w-4" />
                              {lbl}
                            </button>
                          ))}
                        </div>

                        {/* Full name */}
                        <div>
                          <label className={label}>Full name</label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                              placeholder="Jane Doe" className={`${input} pl-10 pr-4`} />
                          </div>
                        </div>

                        {/* Provider fields — animated, never unmounted */}
                        <div className={`overflow-hidden transition-all duration-200 ${role === "organization" ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                          }`}>
                          <div className="flex flex-col gap-4">
                            <div>
                              <label className={label}>Organization name</label>
                              <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                                  tabIndex={role === "organization" ? 0 : -1}
                                  placeholder="Helping Hands NYC" className={`${input} pl-10 pr-4`} />
                              </div>
                            </div>
                            <div>
                              <label className={label}>Primary borough</label>
                              <select value={borough} onChange={e => setBorough(e.target.value)}
                                tabIndex={role === "organization" ? 0 : -1}
                                className={`${input} px-4`}>
                                {["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"].map(b => <option key={b}>{b}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <label className={label}>Email address</label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                              placeholder="your@email.com" className={`${input} pl-10 pr-4`} />
                          </div>
                        </div>

                        {/* Password */}
                        <div>
                          <label className={label}>Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type={showPw ? "text" : "password"} value={password}
                              onChange={e => setPassword(e.target.value)}
                              placeholder="••••••••" className={`${input} pl-10 pr-11`} />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <button onClick={handleSignUp} disabled={loading} className={btn}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      </div>
                    )}

                    {/* ════ FORGOT PASSWORD ════ */}
                    {mode === "forgot" && (
                      <div className="flex flex-col gap-4">

                        {forgotStep === "request" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold text-slate-900">Reset password</h1>
                            <p className="mt-1 text-sm text-slate-400">We'll send a 6-digit code to your email.</p>
                          </div>
                          <div>
                            <label className={label}>Email address</label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com" className={`${input} pl-10 pr-4`} />
                            </div>
                          </div>
                          <button onClick={handleSendReset} disabled={loading} className={btn}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send code <ArrowRight className="h-4 w-4" /></>}
                          </button>
                          <button onClick={() => goMode("signin")}
                            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="h-4 w-4" /> Back to sign in
                          </button>
                        </>)}

                        {forgotStep === "verify" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold text-slate-900">Verify code</h1>
                            <p className="mt-1 text-sm text-slate-400">
                              6-digit code sent to <strong className="text-slate-900">{email}</strong>
                            </p>
                          </div>
                          <input type="text" maxLength={6} value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="000000"
                            className="w-full rounded-xl border border-slate-200 py-4 text-center text-2xl font-bold tracking-[0.5em] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                          <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} className={btn}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify <ArrowRight className="h-4 w-4" /></>}
                          </button>
                          <div className="flex flex-col items-center gap-3">
                            <button onClick={handleSendReset} disabled={loading || resendTimer > 0}
                              className="text-sm font-semibold text-teal-600 disabled:text-slate-400">
                              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                            </button>
                            <button onClick={() => setForgotStep("request")}
                              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                              <ArrowLeft className="h-4 w-4" /> Back
                            </button>
                          </div>
                        </>)}

                        {forgotStep === "reset" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold text-slate-900">New password</h1>
                            <p className="mt-1 text-sm text-slate-400">Choose a strong password.</p>
                          </div>
                          <div>
                            <label className={label}>New password</label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type={showPw ? "text" : "password"} value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                placeholder="Min. 8 characters" className={`${input} pl-10 pr-11`} />
                              <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className={label}>Confirm password</label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type={showPw ? "text" : "password"} value={confirmPw}
                                onChange={e => setConfirmPw(e.target.value)}
                                placeholder="Repeat your password" className={`${input} pl-10 pr-4`} />
                            </div>
                            {confirmPw && newPw !== confirmPw && (
                              <p className="mt-1.5 text-xs text-red-500">Passwords do not match.</p>
                            )}
                          </div>
                          <button onClick={handleUpdatePw}
                            disabled={loading || newPw !== confirmPw || newPw.length < 8}
                            className={btn}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Update password <ArrowRight className="h-4 w-4" /></>}
                          </button>
                        </>)}

                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}