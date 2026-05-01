import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type PasskeyResponse =
  | { valid: true; proof: string; expiresAt: number }
  | { valid?: false; error?: string; expiresAt?: number; proof?: string }
  | null;

export default function AdminPasskeyPage() {
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = passkey.trim();
    if (!trimmed) {
      setError('Passkey is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      if (!supabaseUrl || !anonKey) {
        setError('Configuration error. Contact administrator.');
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/verify-admin-passkey`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passkey: trimmed }),
      });

      const data = (await res.json().catch(() => null)) as PasskeyResponse;

      if (!res.ok || !data || data.valid !== true || !data.proof || !data.expiresAt) {
        console.error('[AdminPasskey] Verification failed:', { 
          status: res.status, 
          ok: res.ok, 
          data 
        });

        const msg =
          !data
            ? 'Invalid passkey.'
            : data.valid === true
              ? 'Security proof missing. Please try again.'
              : (data.error ?? 'Invalid passkey.');
        setError(msg);
        return;
      }

      // Store short-lived proof in sessionStorage (valid for this browser tab only).
      window.sessionStorage.setItem('hp_admin_passkey_proof', data.proof);
      window.sessionStorage.setItem('hp_admin_passkey_expires_at', String(data.expiresAt));
      navigate('/admin-login', { replace: true });
    } catch {
      setError('Unable to verify passkey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
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
            <p className="text-sm text-gray-500">Enter admin passkey to continue</p>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Passkey</label>
          <input
            type="password"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            className="w-full h-11 border border-gray-200 rounded-lg px-3 focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none"
            placeholder="Enter passkey"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Verifying...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
