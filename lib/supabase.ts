import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client for the dashboard API routes.
// Reads with the service-role key when present (self-hosted dev), otherwise
// falls back to the anon key. Returns null when nothing is configured yet so
// the API routes can report `configured: false` instead of crashing.
export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
