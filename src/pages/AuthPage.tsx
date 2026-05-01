import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { 
  User, Building2, Mail, Lock, Eye, EyeOff, 
  ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { BrandMark } from "../components/landing/BrandMark";
import { useAuth } from "../contexts/AuthContext";

const PHRASES = [
  "Find help,\nnot hotlines.",
  "Real people.\nReal support.",
  "From searching\nto supported.",
  "Your community\nis here for you.",
  "No paperwork.\nNo wait rooms.",
];

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
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    // Only redirect if we have BOTH user AND profile loaded
    // Prevents firing during the login→validation→signout transition
    if (!user || !profile) return;

    if (profile.role === 'admin') navigate('/admin', { replace: true });
    else if (profile.role === 'organization') navigate('/cbo', { replace: true });
    else navigate('/client', { replace: true });
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

  // Typewriter logic
  const [typewriterText, setTypewriterText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(55);

  useEffect(() => {
    const handleType = () => {
      const currentPhrase = PHRASES[phraseIndex];
      const isComplete = !isDeleting && typewriterText === currentPhrase;
      const isCleared = isDeleting && typewriterText === "";

      if (isComplete) {
        setTimeout(() => setIsDeleting(true), 2200);
        return;
      }

      if (isCleared) {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setTypingSpeed(55);
        return;
      }

      const nextChar = isDeleting
        ? currentPhrase.substring(0, typewriterText.length - 1)
        : currentPhrase.substring(0, typewriterText.length + 1);

      setTypewriterText(nextChar);
      setTypingSpeed(isDeleting ? 30 : 55);
    };

    const timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [typewriterText, isDeleting, phraseIndex, typingSpeed]);

  const setMode = (newMode: "signin" | "signup" | "forgot") => {
    setSearchParams({ mode: newMode });
    setError(null);
    setShowResetConfirmation(false);
    setForgotStep("request");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  async function handleSignIn() {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn({ email, password });
      // Navigation is handled by the redirect guard above (once profile loads)
    } catch (err: any) {
      if (
        err.message.includes('Invalid login credentials') ||
        err.message.includes('invalid_credentials')
      ) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password || !fullName) {
      setError("Please fill in all required fields.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signUp({
        email,
        password,
        name: fullName,
        role: role === 'community_member' ? 'community_member' : 'organization',
        organization: role === 'organization' ? orgName : undefined,
        borough: role === 'organization' ? borough : undefined,
      });
      setShowConfirmation(true);
    } catch (err: any) {
      if (err.message.includes("already exists")) {
        setError("An account with this email already exists.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Please enter your email address to receive a verification code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Use resetPasswordForEmail WITHOUT redirectTo — this forces Supabase
      // to send a 6-digit OTP code instead of a magic link.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        // No redirectTo — omitting it is what triggers OTP mode
      );
      if (resetError) throw resetError;
      setForgotStep("verify");
      setResendTimer(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      // Re-send the recovery OTP email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        // No redirectTo — omitting it is what triggers OTP mode
      );
      if (resetError) throw resetError;
      setResendTimer(60);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // type must be "recovery" to match resetPasswordForEmail OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "recovery",
      });
      if (verifyError) throw verifyError;
      setForgotStep("reset");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword) return;
    if (newPassword.length < 8) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      // Success — redirect to sign in
      setNewPassword('');
      setConfirmPassword('');
      setMode('signin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* LEFT PANEL — Brand/Visual Side */}
      <div className="hidden w-1/2 flex-col justify-between bg-emerald-950 p-12 text-white md:flex">
        {/* Top section: Logo */}
        <div 
          className="flex cursor-pointer items-center gap-2" 
          onClick={() => navigate("/")}
        >
          <BrandMark className="h-10 w-10" />
          <span className="text-xl font-bold">HealthPowr</span>
        </div>

        {/* Middle section: Typewriter */}
        <div className="flex flex-col gap-6">
          <div className="text-sm font-semibold uppercase tracking-widest text-white/60">
            Trusted by NYC communities
          </div>
          <h2 className="min-h-[120px] whitespace-pre-wrap text-4xl font-extrabold leading-tight tracking-tight">
            {typewriterText}
            <motion.span 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-teal-400"
            >
              |
            </motion.span>
          </h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: phraseIndex >= 1 || isDeleting ? 1 : 0 }}
            className="max-w-sm text-base leading-relaxed text-white/60"
          >
            Connect with 200+ verified community organizations across
            New York City — housing, food, healthcare, and more.
          </motion.p>
        </div>

        {/* Bottom section: Testimonial */}
        <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
          <p className="mb-4 text-sm leading-relaxed text-white/80">
            "I found food assistance for my family within the same afternoon.
            The caseworker responded in under 3 hours."
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">
              M
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Maria R.</div>
              <div className="text-xs text-white/50">Mott Haven, Bronx</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Form Side */}
      <div className="relative flex w-full flex-col items-center justify-center bg-white p-8 md:w-1/2 md:p-16">
        {/* Floating Back Button */}
        <button
          onClick={() => navigate("/")}
          className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 text-[12px] font-bold text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 md:left-10 md:top-10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </button>

        <div className="w-full max-w-[400px]">
          {showConfirmation ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                <Mail className="h-7 w-7 text-teal-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">Check your email</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                We sent a confirmation link to <strong>{email}</strong>.
                Click it to activate your account.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-6 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                ← Back to HealthPowr
              </button>
            </motion.div>
          ) : (
            <>
              {/* Mobile Logo */}
              <div 
                className="mb-8 flex items-center gap-2 md:hidden"
                onClick={() => navigate("/")}
              >
                <BrandMark className="h-8 w-8" />
                <span className="text-lg font-bold text-slate-900">HealthPowr</span>
              </div>

              {/* Mode Switcher */}
              <div className="mb-8 flex w-full rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setMode("signin")}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    mode === "signin"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Create account
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {error && (
                    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                      </div>
                      {error.includes("already exists") && (
                        <button
                          onClick={() => setMode("signin")}
                          className="self-start text-xs font-bold text-red-700 hover:underline"
                        >
                          Sign in instead →
                        </button>
                      )}
                      {error.includes("Invalid email or password") && (
                        <button
                          onClick={() => setMode("forgot")}
                          className="self-start text-xs font-bold text-red-700 hover:underline"
                        >
                          Reset password →
                        </button>
                      )}
                    </div>
                  )}

                  {mode === "signin" ? (
                    <div className="flex flex-col">
                      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                        Welcome back
                      </h1>
                      <p className="text-sm text-slate-400 mb-6">
                        Sign in to your HealthPowr account.
                      </p>

                      {/* Email */}
                      <div className="mb-4 text-left">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="mb-6 text-left">
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Password
                          </label>
                          <button 
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-11 text-sm transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSignIn}
                        disabled={isLoading}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Sign in <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : mode === "signup" ? (
                    <div className="flex flex-col">
                      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">Create an account</h1>
                      <p className="mb-8 text-sm text-slate-400">Join our community and get the support you need.</p>

                      {/* Role Selector Signup */}
                      <div className="mb-6 grid grid-cols-2 gap-2">
                        {[
                          { id: "community_member", label: "Client", icon: User },
                          { id: "organization", label: "Provider", icon: Building2 },
                        ].map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setRole(r.id as any)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                              role === r.id
                                ? "border-teal-500 bg-teal-50 text-teal-700"
                                : "border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            <r.icon className="h-4 w-4" />
                            {r.label}
                          </button>
                        ))}
                      </div>

                      {/* Name */}
                      <div className="mb-4 text-left">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Jane Doe"
                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                        </div>
                      </div>

                      {role === 'organization' && (
                        <>
                          {/* Org Name */}
                          <div className="mb-4 text-left">
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Organization Name
                            </label>
                            <div className="relative">
                              <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Helping Hands NYC"
                                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              />
                            </div>
                          </div>

                          {/* Borough */}
                          <div className="mb-4 text-left">
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Primary Borough
                            </label>
                            <select
                              value={borough}
                              onChange={(e) => setBorough(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                            >
                              <option value="Manhattan">Manhattan</option>
                              <option value="Brooklyn">Brooklyn</option>
                              <option value="Queens">Queens</option>
                              <option value="Bronx">Bronx</option>
                              <option value="Staten Island">Staten Island</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Email */}
                      <div className="mb-4 text-left">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="mb-6 text-left">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-11 text-sm transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Create account <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {showResetConfirmation ? (
                        <div className="text-center py-4">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                            <CheckCircle2 className="h-7 w-7 text-teal-600" />
                          </div>
                          <h3 className="mb-2 text-xl font-bold text-slate-900">Success!</h3>
                          <p className="text-sm leading-relaxed text-slate-400">
                            Your password has been updated. You can now sign in with your new password.
                          </p>
                          <button
                            onClick={() => setMode("signin")}
                            className="mt-6 text-sm font-semibold text-teal-600 hover:text-teal-700"
                          >
                            ← Back to sign in
                          </button>
                        </div>
                      ) : forgotStep === "request" ? (
                        <>
                          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">Reset password</h1>
                          <p className="mb-8 text-sm text-slate-400">Enter your email and we'll send you a verification code.</p>

                          {/* Email */}
                          <div className="mb-6 text-left">
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Email address
                            </label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              />
                            </div>
                          </div>

                          <button
                            onClick={handleResetPassword}
                            disabled={isLoading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                Send code <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setMode("signin")}
                            className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2"
                          >
                            <ArrowLeft className="h-4 w-4" /> Back to sign in
                          </button>
                        </>
                      ) : forgotStep === "verify" ? (
                        <>
                          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">Verify code</h1>
                          <p className="mb-8 text-sm text-slate-400">We sent a 6-digit code to <span className="font-semibold text-slate-900">{email}</span>.</p>

                          {/* OTP */}
                          <div className="mb-6 text-left">
                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">
                              Verification Code
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              className="w-full rounded-xl border border-slate-200 py-4 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 placeholder:text-slate-200 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                            />
                          </div>

                          <button
                            onClick={handleVerifyOtp}
                            disabled={isLoading || otp.length < 6}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-60"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                Verify code <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>

                          <div className="mt-6 flex flex-col items-center gap-4">
                            <button
                              onClick={handleResendCode}
                              disabled={isLoading || resendTimer > 0}
                              className="text-sm font-semibold text-teal-600 hover:text-teal-700 disabled:text-slate-400"
                            >
                              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Didn't get a code? Resend"}
                            </button>
                            
                            <p className="text-[11px] leading-relaxed text-slate-400 text-center max-w-[280px]">
                              Note: If you received an email with a <strong>Reset Password</strong> link instead of a code, clicking it will also work.
                            </p>

                            <button
                              onClick={() => setForgotStep("request")}
                              className="text-sm font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2"
                            >
                              <ArrowLeft className="h-4 w-4" /> Back to email
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Reset step */}
                          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                            New password
                          </h1>
                          <p className="text-sm text-slate-400 mb-6">
                            Choose a strong password for your account.
                          </p>

                          {/* New password */}
                          <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              New password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Confirm password */}
                          <div className="mb-6">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              Confirm password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your password"
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                              />
                            </div>
                            {/* Mismatch warning */}
                            {confirmPassword && newPassword !== confirmPassword && (
                              <p className="text-xs text-red-500 mt-1.5">Passwords do not match.</p>
                            )}
                          </div>

                          <button
                            onClick={handleUpdatePassword}
                            disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 8}
                            className="w-full h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                          >
                            {isLoading
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <>Update password <ArrowRight className="w-4 h-4" /></>
                            }
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
