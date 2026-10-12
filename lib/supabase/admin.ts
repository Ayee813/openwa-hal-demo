import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Secret key client. Bypasses RLS entirely.
 *
 * Allowed in exactly two places: route handlers under `app/api/**` and Supabase
 * Edge Functions. The `server-only` import above turns any accidental import
 * from a "use client" file into a build error, and `scripts/check-secrets.sh`
 * catches the rest in CI.
 *
 * Reach for this only for work that genuinely cannot be done as the caller —
 * creating auth users, writing a batch on behalf of an uploader. Everything else
 * belongs on the RLS-scoped server client in `./server`.
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
