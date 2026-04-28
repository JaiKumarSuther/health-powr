import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function StaffAuthPage() {
  const navigate = useNavigate();
  const { signIn, user, isSubmitting } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCheckingMembershipRef = useRef(false);

  useEffect(() => {
    // Staff login has been unified into /auth (auto-detect role + redirect).
    navigate('/auth', { replace: true });
    return;
    // Do NOT auto-navigate while we are in the middle of a membership check.
    // handleSignIn navigates manually after the check passes.
    if (isCheckingMembershipRef.current) return;
    if (user) {
      navigate('/cbo', { replace: true });
    }
  }, [navigate, user]);

  async function handleSignIn() {
    setError(null);
    const raw = loginEmail.trim().toLowerCase();
    if (!raw || !password) {
      setError('Login email and password are required.');
      return;
    }

    // Resolve what to sign in with:
    // - Full login email "jai_kumar@alpha-hive.healthpowr.app" → use as-is
    // - Username only "jai_kumar" → can't resolve org, show hint
    const emailToUse = raw;
    if (!raw.includes('@')) {
      setError(
        'Please use your full login email (e.g. jai_kumar@alpha-hive.healthpowr.app). ' +
        'You can find it in the credentials your admin sent you.'
      );
      return;
    }

    // If it's not a healthpowr.app login email (e.g. they entered personal email),
    // we still attempt sign-in — it will fail with "Invalid login credentials" if wrong.
    isCheckingMembershipRef.current = true;
    try {
      await signIn({ email: emailToUse, password });

      // Verify this user is actually a staff member (not an org owner)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role, organization_id')
          .eq('profile_id', currentUser.id)
          .maybeSingle();

        if (!membership) {
          await supabase.auth.signOut();
          setError('Staff account not found. Please contact your organization admin.');
          return;
        }

        if (membership.role === 'owner') {
          await supabase.auth.signOut();
          setError('This login is for staff members only. Organization owners must use the main login.');
          return;
        }

        if (!['member', 'admin'].includes(membership.role)) {
          await supabase.auth.signOut();
          setError('Invalid staff credentials. Please contact your organization admin.');
          return;
        }
      }

      navigate('/cbo', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Unable to sign in.';
      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password. Use the login email your admin gave you (e.g. name@org.healthpowr.app).');
      } else {
        setError(msg);
      }
    } finally {
      isCheckingMembershipRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Portal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in with the login credentials your organization admin provided.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Login Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && void handleSignIn()}
                placeholder="yourname@org.healthpowr.app"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                className="w-full h-11 border border-gray-200 rounded-xl pl-10 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Your admin gave you a login email ending in <span className="font-mono">.healthpowr.app</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && void handleSignIn()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full h-11 border border-gray-200 rounded-xl pl-10 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-red-500 mt-0.5 text-base leading-none">⚠</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleSignIn()}
          className="w-full h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="text-center">
          <Link to="/" className="text-sm text-teal-700 hover:text-teal-800 font-medium">
            Back to main portal
          </Link>
        </div>
      </div>
    </div>
  );
}
