import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLoginPage() {
  const { user, profile, isResolvingRole, signIn, isSubmitting } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForRole, setIsWaitingForRole] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only navigate once role is confirmed from DB (profile loaded).
    // Never navigate away while role is still resolving — doing so can
    // land an admin on /client if onAuthStateChange hasn't finished yet.
    if (isResolvingRole) return;
    if (!user || !profile) return;
    if (profile.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (isWaitingForRole) {
      // Role resolved but it is not admin — clear the spinner so the user
      // can see the page again and sign in with correct credentials.
      setIsWaitingForRole(false);
      setError('This account does not have admin access.');
    }
  }, [user, profile, isResolvingRole, isWaitingForRole, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsWaitingForRole(false);
    try {
      // Do not trim password: it must match Supabase exactly.
      // Trimming can break passwords that intentionally include leading/trailing whitespace.
      await signIn({ email: email.trim(), password });
      // Do NOT navigate immediately; wait for AuthContext to confirm DB role.
      setIsWaitingForRole(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/healthPowr-logo.png"
            alt="HealthPowr"
            className="h-10 w-10 rounded-xl object-contain"
            draggable={false}
          />
          <div>
            <div className="text-[18px] font-extrabold tracking-tight text-slate-900">
              <span className="text-teal-600">Health</span>
              <span className="text-emerald-500">Powr</span>{" "}
              <span className="text-slate-700">Admin</span>
            </div>
            <p className="text-sm text-gray-500">Use an admin account to enter the portal.</p>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 border border-gray-200 rounded-lg px-3 focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none"
            placeholder="admin@healthpowr.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 border border-gray-200 rounded-lg px-3 focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none"
            placeholder="••••••••"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {isWaitingForRole && (
          <p className="text-sm text-gray-500">Confirming admin access…</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting || isWaitingForRole}
          className="w-full h-11 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}