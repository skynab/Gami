import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, for sign-in and saved models. Its own module so it's only downloaded when needed:
 * learning never touches it. Configured with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).
 */
// Only imported once `accountsEnabled` has checked both are set.
export const client: SupabaseClient = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, detectSessionInUrl: true },
});
