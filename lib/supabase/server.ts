import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types";

/**
 * Server client for React Server Components, server actions and route handlers.
 * Publishable key + the signed-in user's cookie, so it acts *as that user* and
 * RLS is the boundary. This is what ordinary reads should use — do not route
 * plain queries through an Edge Function.
 *
 * Wrapped in React `cache()`: a page, its layout and any helper all call this,
 * and without deduplication each one would parse cookies and construct its own
 * client (and its own JWKS cache) for the same request.
 */
export const createClient = cache(async () => {
  // Request time only: auth reads the clock (`getClaims()` checks expiry), which
  // a runtime prefetch must not do. Cookies alone do not opt out of that.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
});
