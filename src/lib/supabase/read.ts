import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Anonymous server-side READ client (no user session, anon/publishable key).
 *
 * The public prode site does not use Supabase Auth for participants (identity is
 * a custom signed cookie + service-role writes). Use this for public reads in
 * Server Components — it only sees what RLS public SELECT policies / SECURITY
 * DEFINER read-RPCs expose (never PII like DNI / email / phone).
 */
export function createReadClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
