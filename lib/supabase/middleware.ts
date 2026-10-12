import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types";

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the session cookie and gates unauthenticated traffic.
 *
 * Runs on every request, so it does no network I/O: `getClaims()` verifies the
 * JWT locally against the project's public key (cached after the first fetch),
 * where `getUser()` would call `/auth/v1/user` each time.
 *
 * Role checks are not done here — `requireProfile()` in `lib/auth.ts` reads the
 * live `profiles` row. RLS remains the boundary that actually holds.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  const { pathname } = request.nextUrl;

  if (!claims) {
    if (isPublic(pathname)) return response;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Signed in and asking for the login page. Plain GETs only: the sign-in form
  // is a server action POSTed to /login, and `?error=` is where an inactive
  // account is sent — bouncing either back to `/` would break or loop.
  if (
    isPublic(pathname) &&
    request.method === "GET" &&
    !request.headers.has("next-action") &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
