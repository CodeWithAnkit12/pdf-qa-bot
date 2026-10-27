import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign-in landing for the email link.
 *
 * Supabase can send the link in two styles depending on the email
 * template, so we handle both:
 *
 *   1. token_hash + type  — the style the default email templates use
 *      once you point them at this route. Verified with verifyOtp().
 *      This is what the magic link / "confirm signup" email uses.
 *
 *   2. code               — the OAuth / PKCE style, exchanged with
 *      exchangeCodeForSession(). Kept as a fallback so social login
 *      would also work here later.
 *
 * On success we set the session cookie and send the user to `next`
 * (default the dashboard). On any failure we bounce back to /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const supabase = await createClient();

  // Style 1: token hash from the email template.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Style 2: OAuth / PKCE code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
