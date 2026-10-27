import { createClient } from '@supabase/supabase-js';

/**
 * Secret-key (service role) client. BYPASSES Row Level Security.
 *
 * Only two places legitimately need it:
 *   1. the upload pipeline, which writes chunks on the user's behalf
 *   2. the public customer chat, where there is no signed-in user
 *
 * Because RLS is off here, every query made with this client MUST
 * filter by owner_id in application code. That filter is the only
 * thing keeping one business's documents away from another's.
 *
 * SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ prefix on purpose —
 * that prefix would inline it into the browser bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
