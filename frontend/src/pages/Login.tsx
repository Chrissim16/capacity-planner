import { useState } from 'react';
import type { FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { withTimeout } from '../utils/withTimeout';

function normalizeAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }
  if (lower.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('timed out')) {
    return 'The request timed out. Please try again.';
  }
  return 'Authentication failed. Please try again.';
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured()) {
        setError('Sign-in is currently unavailable.');
        return;
      }

      if (isSignUpMode && password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }

      if (isSignUpMode) {
        const { error: signUpError } = await withTimeout(
          supabase.auth.signUp({ email: email.trim(), password }),
          10000,
          'Sign-up'
        );
        if (signUpError) {
          setError(normalizeAuthError(signUpError.message));
          return;
        }
        setInfo('Account created. Check your email for verification if required.');
      } else {
        const { error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim(), password }),
          10000,
          'Sign-in'
        );
        if (signInError) {
          setError(normalizeAuthError(signInError.message));
          return;
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setError(normalizeAuthError(raw));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src="/mileway-logo.png"
            alt="Mileway"
            className="h-9"
            draggable={false}
          />
        </div>

        <div className="rounded-card border border-[#F0EFED] bg-white shadow-sm p-8">
          <h1
            className="text-3xl font-bold text-[#1A1A1A] tracking-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.02em' }}
          >
            Capacity Planner
          </h1>
          <p className="mt-1.5 text-sm text-[#6B7280]">Sign in to continue</p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E3] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0ED3CF]/40 focus:border-[#0ED3CF] transition-colors"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E3] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0ED3CF]/40 focus:border-[#0ED3CF] transition-colors"
                autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-[#EF4444] flex items-start gap-1.5">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
            {info && <p className="text-sm text-[#22C55E]">{info}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#1A1A1A] hover:opacity-85 disabled:opacity-50 text-white font-medium py-2.5 transition-opacity duration-150 mt-2"
            >
              {isSubmitting ? 'Please wait…' : isSignUpMode ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSignUpMode((v) => !v);
              setError(null);
              setInfo(null);
            }}
            className="mt-4 w-full text-sm text-[#0ED3CF] hover:underline transition-colors"
          >
            {isSignUpMode ? 'Have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-[#9CA3AF]">
          Mileway IT Capacity Planner · VS Finance
        </p>
      </div>
    </div>
  );
}
