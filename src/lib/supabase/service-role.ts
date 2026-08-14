import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. BYPASSES RLS. Server-side only.
 *
 * Per AGENTS.md: SUPABASE_SERVICE_ROLE_KEY must never appear in a file
 * under app/ that lacks "use server" or lives outside app/api/. This
 * module lives in lib/ and is imported only by Route Handlers and sync
 * jobs — never by a React component.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
