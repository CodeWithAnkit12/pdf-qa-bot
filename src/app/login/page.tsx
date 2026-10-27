'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // signUp creates the user; signInWithPassword checks an existing one.
    // With "Confirm email" turned off in Supabase, signUp returns a
    // session right away, so both paths land us signed in.
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Safety net: if email confirmation is still ON, signUp returns a
    // user but no session. Tell the user instead of silently failing.
    if (mode === 'signup' && !data.session) {
      setError('Check your email to confirm your account, then sign in.');
      return;
    }

    // Full navigation so the browser sends the freshly-set session
    // cookies with the request. router.push() does a soft (RSC) fetch
    // that can race ahead of the cookie write and land on the middleware
    // before the session exists — causing a redirect loop back to /login.
    window.location.href = '/';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        {mode === 'signup' ? 'Create your business account' : 'Business sign in'}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Upload your documents and get a chat link for your customers.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (at least 6 characters)"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signup' ? 'signin' : 'signup');
          setError(null);
        }}
        className="mt-6 text-sm text-slate-500 hover:text-slate-900"
      >
        {mode === 'signup'
          ? 'Already have an account? Sign in'
          : 'New here? Create an account'}
      </button>
    </main>
  );
}
