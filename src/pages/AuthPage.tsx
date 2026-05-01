import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import {
  User, Building2, Mail, Lock, Eye, EyeOff,
  ArrowRight, Loader2, AlertCircle, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { BrandMark } from "../components/landing/BrandMark";
import { useAuth } from "../contexts/AuthContext";

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, profile } = useAuth();
  const mode = (searchParams.get("mode") as "signin" | "signup" | "forgot") || "signin";
  const [role, setRole] = useState<"community_member" | "organization">(
    (searchParams.get("role") as any) || "community_member"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "verify" | "reset">("request");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [borough, setBorough] = useState("Manhattan");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.role === "admin") navigate("/admin", { replace: true });
    else if (profile.role === "organization") navigate("/cbo", { replace: true });
    else navigate("/client", { replace: true });
  }, [user, profile, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (location.pathname === "/auth/reset-password") {
      setSearchParams({ mode: "forgot" });
      setForgotStep("reset");
    }
  }, [location.pathname, setSearchParams]);

  const setMode = (newMode: "signin" | "signup" | "forgot") => {
    setSearchParams({ mode: newMode });
    setError(null);
    setForgotStep("request");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  async function handleSignIn() {
    if (!email || !password) { setError("Please enter both email and password."); return; }
    setIsLoading(true); setError(null);
    try {
      await signIn({ email, password });
    } catch (err: any) {
      setError(
        err.message.includes("Invalid login credentials") || err.message.includes("invalid_credentials")
          ? "Incorrect email or password. Please try again."
          : err.message
      );
    } finally { setIsLoading(false); }
  }

  async function handleSignUp() {
    if (!email || !password || !fullName) { setError("Please fill in all required fields."); return; }
    setIsLoading(true); setError(null);
    try {
      await signUp({
        email, password, name: fullName,
        role: role === "community_member" ? "community_member" : "organization",
        organization: role === "organization" ? orgName : undefined,
        borough: role === "organization" ? borough : undefined,
      });
      setShowConfirmation(true);
    } catch (err: any) {
      setError(err.message.includes("already exists") ? "An account with this email already exists." : err.message);
    } finally { setIsLoading(false); }
  }

  async function handleResetPassword() {
    if (!email) { setError("Please enter your email address."); return; }
    setIsLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email);
      if (e) throw e;
      setForgotStep("verify"); setResendTimer(60);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }

  async function handleResendCode() {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email);
      if (e) throw e;
      setResendTimer(60); setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) { setError("Please enter the 6-digit code."); return; }
    setIsLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
      if (e) throw e;
      setForgotStep("reset");
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword || newPassword.length < 8) return;
    setIsLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword });
      if (e) throw e;
      setNewPassword(""); setConfirmPassword(""); setMode("signin");
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }

  const inputBase =
    "w-full rounded-xl border border-slate-200 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30";
  const labelBase =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    // h-screen + overflow-hidden: the two panels are always exactly viewport height.
    // Nothing outside can stretch them.
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ═══════════════════════════════════════════════
          LEFT PANEL — completely static
          Uses flex-col with fixed px/pt/pb padding so
          the three zones never move no matter what the
          right panel does.
          ═══════════════════════════════════════════════ */}
      <div className="hidden w-1/2 flex-shrink-0 flex-col bg-emerald-950 text-white md:flex">

        {/* Zone 1 — Logo, pinned to top */}
        <div className="px-12 pt-12">
          <div className="flex cursor-pointer items-center gap-2" onClick={() => navigate("/")}>
            <BrandMark className="h-10 w-10" />
            <span className="text-xl font-bold">HealthPowr</span>
          </div>
        </div>

        {/* Zone 2 — Headline, centred in remaining space */}
        <div className="flex flex-1 flex-col justify-center px-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
            Trusted by NYC communities
          </p>
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight">
            Real people.<br />Real support.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-white/60">
            Connect with 200+ verified community organizations across New York
            City — housing, food, healthcare, and more.
          </p>
        </div>

        {/* Zone 3 — Testimonial, pinned to bottom */}
        <div className="px-12 pb-12">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
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

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — scrollable column
          "Back to home" is first in normal flow (NOT
          absolute), so it never overlaps anything.
          ═══════════════════════════════════════════════ */}
      <div className="flex w-full flex-col overflow-y-auto md:w-1/2">

        {/* Back to home — always at top, part of the flow */}
        <div className="px-8 pt-6 md:px-16 md:pt-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-[12px] font-bold text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </button>
        </div>

        {/* Form — centred in the remaining vertical space */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-8 md:px-16">
          <div className="w-full max-w-[400px]">

            {/* Mobile logo */}
            <div className="mb-8 flex cursor-pointer items-center gap-2 md:hidden" onClick={() => navigate("/")}>
              <BrandMark className="h-8 w-8" />
              <span className="text-lg font-bold text-slate-900">HealthPowr</span>
            </div>

            {showConfirmation ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                  <Mail className="h-7 w-7 text-teal-600" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Check your email</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
                </p>
                <button onClick={() => navigate("/")} className="mt-6 text-sm font-semibold text-teal-600 hover:text-teal-700">
                  ← Back to HealthPowr
                </button>
              </motion.div>
            ) : (
              <>
                {/* Tab switcher */}
                <div className="mb-8 flex w-full rounded-xl bg-slate-100 p-1">
                  {(["signin", "signup"] as const).map((m) => (
                    <button key={m} onClick={() => { setMode(m); setError(null); }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}>
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={mode}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>

                    {/* Error */}
                    {error && (
                      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                          <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                        {error.includes("already exists") && (
                          <button onClick={() => setMode("signin")} className="self-start text-xs font-bold text-red-700 hover:underline">Sign in instead →</button>
                        )}
                        {error.includes("Incorrect email") && (
                          <button onClick={() => setMode("forgot")} className="self-start text-xs font-bold text-red-700 hover:underline">Reset password →</button>
                        )}
                      </div>
                    )}

                    {/* ── SIGN IN ── */}
                    {mode === "signin" && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <h1 className="text-2xl font-extrabold text-slate-900">Welcome back</h1>
                          <p className="mt-1 text-sm text-slate-400">Sign in to your HealthPowr account.</p>
                        </div>
                        <div>
                          <label className={labelBase}>Email address</label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                              placeholder="your@email.com" className={`${inputBase} pl-10 pr-4`} />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                            <button type="button" onClick={() => setMode("forgot")}
                              className="text-xs font-semibold text-teal-600 hover:text-teal-700">Forgot password?</button>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type={showPassword ? "text" : "password"} value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                              placeholder="••••••••" className={`${inputBase} pl-10 pr-11`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <button onClick={handleSignIn} disabled={isLoading}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      </div>
                    )}

                    {/* ── SIGN UP ── */}
                    {mode === "signup" && (
                      <div className="flex flex-col gap-4">
                        <div>
                          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create an account</h1>
                          <p className="mt-1 text-sm text-slate-400">Join our community and get the support you need.</p>
                        </div>

                        {/* Client / Provider */}
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "community_member", label: "Client", Icon: User },
                            { id: "organization", label: "Provider", Icon: Building2 },
                          ] as const).map(({ id, label, Icon }) => (
                            <button key={id} type="button" onClick={() => setRole(id as any)}
                              className={`flex w-full flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-colors ${role === id
                                  ? "border-teal-500 bg-teal-50 text-teal-700"
                                  : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}>
                              <Icon className="h-4 w-4" />
                              {/* invisible bold copy pre-reserves width → no reflow on select */}
                              <span className="relative h-4 text-xs">
                                <span className="invisible font-bold">{label}</span>
                                <span className={`absolute inset-0 flex items-center justify-center ${role === id ? "font-bold" : "font-semibold"}`}>
                                  {label}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Full name */}
                        <div>
                          <label className={labelBase}>Full Name</label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                              placeholder="Jane Doe" className={`${inputBase} pl-10 pr-4`} />
                          </div>
                        </div>

                        {/* Provider-only fields: in DOM always, animated height */}
                        <div className={`overflow-hidden transition-all duration-200 ${role === "organization" ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                          }`}>
                          <div className="flex flex-col gap-4">
                            <div>
                              <label className={labelBase}>Organization Name</label>
                              <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                                  tabIndex={role === "organization" ? 0 : -1}
                                  placeholder="Helping Hands NYC" className={`${inputBase} pl-10 pr-4`} />
                              </div>
                            </div>
                            <div>
                              <label className={labelBase}>Primary Borough</label>
                              <select value={borough} onChange={(e) => setBorough(e.target.value)}
                                tabIndex={role === "organization" ? 0 : -1}
                                className={`${inputBase} px-4`}>
                                {["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"].map(b => <option key={b}>{b}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <label className={labelBase}>Email address</label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                              placeholder="your@email.com" className={`${inputBase} pl-10 pr-4`} />
                          </div>
                        </div>

                        {/* Password */}
                        <div>
                          <label className={labelBase}>Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input type={showPassword ? "text" : "password"} value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••" className={`${inputBase} pl-10 pr-11`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <button onClick={handleSignUp} disabled={isLoading}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      </div>
                    )}

                    {/* ── FORGOT ── */}
                    {mode === "forgot" && (
                      <div className="flex flex-col gap-4">
                        {forgotStep === "request" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reset password</h1>
                            <p className="mt-1 text-sm text-slate-400">We'll send a verification code to your email.</p>
                          </div>
                          <div>
                            <label className={labelBase}>Email address</label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com" className={`${inputBase} pl-10 pr-4`} />
                            </div>
                          </div>
                          <button onClick={handleResetPassword} disabled={isLoading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send code <ArrowRight className="h-4 w-4" /></>}
                          </button>
                          <button onClick={() => setMode("signin")}
                            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="h-4 w-4" /> Back to sign in
                          </button>
                        </>)}

                        {forgotStep === "verify" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Verify code</h1>
                            <p className="mt-1 text-sm text-slate-400">
                              We sent a 6-digit code to <strong className="text-slate-900">{email}</strong>.
                            </p>
                          </div>
                          <div>
                            <label className={`${labelBase} text-center`}>Verification Code</label>
                            <input type="text" maxLength={6} value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              className="w-full rounded-xl border border-slate-200 py-4 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 placeholder:text-slate-200 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                          </div>
                          <button onClick={handleVerifyOtp} disabled={isLoading || otp.length < 6}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify code <ArrowRight className="h-4 w-4" /></>}
                          </button>
                          <div className="flex flex-col items-center gap-3">
                            <button onClick={handleResendCode} disabled={isLoading || resendTimer > 0}
                              className="text-sm font-semibold text-teal-600 hover:text-teal-700 disabled:text-slate-400">
                              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Didn't get a code? Resend"}
                            </button>
                            <button onClick={() => setForgotStep("request")}
                              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                              <ArrowLeft className="h-4 w-4" /> Back to email
                            </button>
                          </div>
                        </>)}

                        {forgotStep === "reset" && (<>
                          <div>
                            <h1 className="text-2xl font-extrabold text-slate-900">New password</h1>
                            <p className="mt-1 text-sm text-slate-400">Choose a strong password for your account.</p>
                          </div>
                          <div>
                            <label className={labelBase}>New password</label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type={showPassword ? "text" : "password"} value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters" className={`${inputBase} pl-10 pr-11`} />
                              <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className={labelBase}>Confirm password</label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input type={showPassword ? "text" : "password"} value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your password" className={`${inputBase} pl-10 pr-4`} />
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                              <p className="mt-1.5 text-xs text-red-500">Passwords do not match.</p>
                            )}
                          </div>
                          <button onClick={handleUpdatePassword}
                            disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 8}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Update password <ArrowRight className="h-4 w-4" /></>}
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