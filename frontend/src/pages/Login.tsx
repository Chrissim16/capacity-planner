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
          supabase.auth.signUp({
            email: email.trim(),
            password,
          }),
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
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/mileway-logo.png"
            alt="Mileway"
            className="h-9 dark:brightness-0 dark:invert"
            draggable={false}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Capacity Planner</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to continue</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#0089DD] hover:bg-[#007ac4] disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
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
          className="mt-4 w-full text-sm text-[#0089DD] hover:underline"
        >
          {isSignUpMode ? 'Have an account? Sign in' : 'Need an account? Create one'}
        </button>
        </div>
      </div>
    </div>
  );
}

