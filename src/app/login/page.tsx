'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Aurora from '@/components/aurora';
import Tilt from '@/components/tilt';
import { Brand } from '@/components/logo';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The landing page links to /login?mode=signup.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') setMode('signup');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    // signUp creates the user; signInWithPassword checks an existing one.
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If "Confirm email" is ON in Supabase, signUp returns a user but
    // no session until the email link is clicked.
    if (mode === 'signup' && !data.session) {
      setNotice(`We sent a confirmation link to ${email}. Open it, then sign in here.`);
      setMode('signin');
      return;
    }

    // Full navigation so the browser sends the freshly-set session
    // cookies with the request.
    window.location.href = '/';
  }

  const isSignup = mode === 'signup';

  return (
    <>
      <Aurora />
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
        <header className="py-5">
          <Brand />
        </header>

        <main className="grid flex-1 items-center gap-12 pb-16 lg:grid-cols-2">
          <div className="hidden lg:block">
            <Tilt className="w-64 animate-pop" max={16}>
              <div className="animate-float">
                <Image
                  src="/brand/logo.png"
                  alt="PDF QA Bot robot"
                  width={256}
                  height={256}
                  priority
                  className="rounded-full drop-shadow-[0_30px_60px_rgb(79_209_255/0.35)]"
                />
              </div>
            </Tilt>
            <h2 className="mt-10 max-w-md animate-rise font-display text-5xl leading-[1.02] font-bold [animation-delay:150ms]">
              <span className="text-gradient">Your support desk, made from one PDF.</span>
            </h2>
            <p className="mt-5 max-w-md animate-rise text-lg text-mist [animation-delay:280ms]">
              Every answer quotes your document and shows the page, so customers can check it.
            </p>
          </div>

          <div className="glass mx-auto w-full max-w-md animate-rise rounded-[32px] p-7 sm:p-9 [animation-delay:120ms]">
            <h1 className="font-display text-3xl font-bold">
              {isSignup ? 'Create your bot' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-mist">
              {isSignup
                ? 'Make an account, then upload your first PDF.'
                : 'Sign in to manage your documents and tickets.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-paper">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-paper">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="field"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5 !text-base">
                {loading ? (
                  <>
                    <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-midnight/30 border-t-midnight" />
                    {isSignup ? 'Creating account…' : 'Signing in…'}
                  </>
                ) : isSignup ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>

              <div aria-live="polite" className="min-h-5 text-sm">
                {error && <p className="text-[#ff8a80]">{error}</p>}
                {notice && <p className="text-emerald-300">{notice}</p>}
              </div>
            </form>

            <p className="mt-2 border-t border-white/10 pt-6 text-sm text-mist">
              {isSignup ? 'Already have an account?' : 'New here?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(isSignup ? 'signin' : 'signup');
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-glow underline-offset-4 hover:underline"
              >
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
