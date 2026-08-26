import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Anon Supabase client for public, session-independent reads (league
 * history, standings, scoring). Unlike server.ts, this doesn't depend on
 * request cookies, so it's safe to call from build-time contexts like
 * `generateStaticParams` where `cookies()` isn't available. Every table
 * queried through this client must have a "public read" RLS policy (see
 * supabase/migrations/20260101000008_rls.sql) — never use this for
 * anything gated by auth.uid().
 */
export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
