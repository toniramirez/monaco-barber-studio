import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * ⚠️ Admin client — BYPASSES RLS. Server-only.
 *
 * Use ONLY inside Server Actions / Route Handlers AFTER validating the caller
 * (rate-limit, OTP, Zod). The prode flow relies on this because anonymous web
 * visitors cannot write to `clients` / `prode_*` directly (RLS denies them).
 *
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Completá .env.local antes de usar el admin client.",
    );
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
