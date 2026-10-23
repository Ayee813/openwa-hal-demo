import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hal_session";
const PUBLIC_PATHS = ["/login"];

/**
 * Sends visitors without a session cookie to /login. The cookie is only
 * checked for presence here; pages decrypt it and check expiry through
 * `requireSession()` in lib/session.ts, and send expired or rejected sessions
 * to /login?error=…, where the stale cookie is dropped.
 */
export default function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (pathname === "/login" && searchParams.has("error") && request.cookies.has(SESSION_COOKIE)) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!isPublic && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|hal-logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
