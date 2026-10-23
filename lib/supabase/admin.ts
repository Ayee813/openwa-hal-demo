import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * The app's only Supabase client: server-side, secret key. Staff sign in with
 * HAL, not Supabase, so there is no per-user client; every query is scoped by
 * the HAL session's branch id instead. The `server-only` import turns an
 * accidental import from a "use client" file into a build error, and
 * `scripts/check-secrets.sh` catches the rest.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set for the admin client",
    );
  }

  return createSupabaseClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
