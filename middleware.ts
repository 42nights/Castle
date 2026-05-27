import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Auth gate. Every route requires a session cookie. The middleware
 * does NOT validate the cookie's signature (that's expensive in an
 * edge function); it only checks presence. Real validation + role
 * checks happen server-side via `getCurrentUser` / `requireOperator`.
 *
 * Guests (non-allowlisted users) have a valid session cookie and pass
 * through here. Their access is restricted server-side to templates only.
 */
export function middleware(req: NextRequest) {
  const cookie = getSessionCookie(req);
  if (cookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/sign-in";
  url.search = `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Match everything EXCEPT:
   *  - `/sign-in` and any deeper auth UI pages
   *  - `/api/auth/*` (Better Auth route handler)
   *  - `/_next/*`, `/favicon`, `/static`, image-optimization, etc.
   *  - common public assets (extensions whitelisted)
   */
  matcher: [
    "/((?!sign-in|api/auth|templates|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff2?)$).+)",
  ],
};
