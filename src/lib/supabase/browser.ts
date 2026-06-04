"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Browser Supabase client (anon / publishable key). For Client Components that
 * need realtime (e.g. the live prode leaderboard). Reads are gated by RLS, so
 * this can only see data exposed by public SELECT policies / safe views.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;
  _client = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return _client;
}
