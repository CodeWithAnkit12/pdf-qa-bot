import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server client bound to the signed-in user's cookies. Still uses the
 * publishable key, so RLS applies — this is the client to reach for by
 * default in route handlers and server components.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; middleware refreshes the
            // session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Returns the signed-in user, or null.
 *
 * Always use getUser(), never getSession(), on the server: getUser()
 * revalidates the token with Supabase, while getSession() trusts a
 * cookie the client could have tampered with.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
