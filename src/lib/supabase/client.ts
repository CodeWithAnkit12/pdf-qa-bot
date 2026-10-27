import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Uses the publishable key, so every query it
 * makes is subject to Row Level Security. Safe to ship to the client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
