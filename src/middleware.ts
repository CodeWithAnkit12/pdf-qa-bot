import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request and guards
 * the owner pages. Customer chat (/chat/...) and its API stay public.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // "/" is public now: it shows the landing page when signed out and
  // the dashboard when signed in (decided in src/app/page.tsx).
  const isOwnerPage = path.startsWith('/tickets');

  if (!user && isOwnerPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the login form.
  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets, icons, brand images and the public chat API
  // (each would otherwise trigger a Supabase auth check).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|opengraph-image|brand/|api/chat).*)'],
};
