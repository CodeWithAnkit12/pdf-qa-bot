'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Action: a function that runs on the server but can be called
 * straight from a <form action={...}>. No API route needed, and it
 * works even before JavaScript has loaded.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut(); // clears the session cookies
  redirect('/');
}
