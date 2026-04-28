import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'community_member' | 'organization';
  initialSignUp?: boolean;
}

export function LoginModal({ isOpen, onClose, role, initialSignUp = false }: LoginModalProps) {
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState<'community_member' | 'organization'>(role);
  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organization: '',
    borough: 'Manhattan',
  });

  const { signIn, signUp, isSubmitting } = useAuth();
  const isBusy = isSubmitting;

  const handleRoleSwitch = (newRole: 'community_member' | 'organization') => {
    setCurrentRole(newRole);
    setFormData({ email: '', password: '', name: '', organization: '', borough: 'Manhattan' });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = formData.email.trim();
    const password = formData.password;
    const orgName = formData.organization.trim();

    if (!email || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    if (isSignUp && password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (isSignUp && currentRole === 'organization' && !orgName) {
      setErrorMessage('Organization name is required.');
      return;
    }

    try {
      if (isSignUp) {
        await signUp({
          email,
          password,
          name: formData.name.trim() || undefined,
          role: currentRole,
          organization: currentRole === 'organization' ? orgName : undefined,
          borough: currentRole === 'organization' ? formData.borough : undefined,
        });
        setSuccessMessage('Account created! If email verification is enabled, please check your email, then sign in.');
      } else {
        await signIn({ email, password });
        // Only close if signIn resolved without throwing
        onClose();
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      const lower = rawMessage.toLowerCase();

      // If the user is trying to sign up but the account already exists,
      // switch them to sign-in mode and show a helpful message.
      if (isSignUp && (lower.includes('already exists') || lower.includes('already registered'))) {
        setIsSignUp(false);
        setErrorMessage('An account with this email already exists. Please sign in (or use “Forgot password”).');
        return;
      }

      const message = rawMessage.toLowerCase().includes('auth session missing')
        ? 'Unable to complete sign in. Please try again.'
        : rawMessage;
      setErrorMessage(message);
    }
  };

  const inputClass = "w-full pl-10 pr-4 h-12 border border-gray-200 rounded-2xl text-[14px] focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none transition-all placeholder-gray-400 font-bold";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] p-4 sm:p-0">
      <div className="bg-white rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] border border-gray-100 flex flex-col">
        <div className="p-8 overflow-y-auto flex-1 scrollbar-hide">
          {/* Content scrolls smoothly without visible scrollbar */}
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl bg-teal-50 text-teal-600">
                {currentRole === 'community_member' ? 'C' : 'O'}
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 uppercase tracking-tight">
                  {currentRole === 'community_member' ? 'Client Portal' : 'Provider Portal'}
                </h2>
                <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">HealthPowr</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Toggle Switch */}
          <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => handleRoleSwitch('community_member')}
              className={`flex-1 h-10 rounded-xl text-[12px] font-bold uppercase tracking-tight transition-all ${
                currentRole === 'community_member'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('organization')}
              className={`flex-1 h-10 rounded-xl text-[12px] font-bold uppercase tracking-tight transition-all ${
                currentRole === 'organization'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Provider
            </button>
          </div>

          <form
            onSubmit={(e) => {
              handleSubmit(e);
              void handleAuth();
            }}
            className="space-y-5"
          >
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 h-12 border border-gray-200 rounded-2xl text-[14px] focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none transition-all placeholder-gray-400 font-bold"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={inputClass}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isSignUp && currentRole === 'organization' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Organization Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    className="w-full px-4 h-12 border border-gray-200 rounded-2xl text-[14px] focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none transition-all placeholder-gray-400 font-bold"
                    placeholder="Your Organization"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Borough</label>
                  <select
                    value={formData.borough}
                    onChange={(e) => setFormData({...formData, borough: e.target.value})}
                    className="w-full px-4 h-12 border border-gray-200 rounded-2xl text-[14px] focus:border-teal-600 focus:ring-4 focus:ring-teal-50 outline-none transition-all font-bold bg-white"
                  >
                    {['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {(errorMessage || successMessage) && (
              <div
                className={`rounded-2xl px-4 py-3 text-[13px] font-bold border ${
                  errorMessage
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}
              >
                {errorMessage ?? successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className={`w-full h-12 rounded-2xl font-bold text-white transition-all text-[14px] uppercase tracking-tight bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 ${isBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isBusy ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                disabled={isBusy || !formData.email.trim()}
                onClick={() => {
                  onClose(); // close the modal
                  navigate('/auth?mode=forgot');
                }}
                className="text-[12px] font-bold uppercase tracking-tight transition-colors min-h-[44px] text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[14px] font-bold uppercase tracking-tight transition-colors min-h-[44px] text-teal-600 hover:text-teal-700"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Need an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}