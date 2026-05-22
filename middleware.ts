import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Auth gate. Anything that isn't sign-in / Better Auth's own routes /
 * health / static assets requires a session cookie. The middleware
 * does NOT validate the cookie's signature (that's expensive in an
 * edge function); it only checks presence. Validation + the email
 * allowlist live server-side (`convex/auth.ts` `databaseHooks`) and
 * in protected server actions / route handlers via `isAuthenticated`.
 *
 * The point of this check is to short-circuit unauthenticated browser
 * navigation, not to be a security boundary on its own.
 */
export function middleware(req: NextRequest) {
  // The chat landing at "/" is intentionally public — anyone can hit
  // Castle's chat. The operator console (everything else) still needs
  // a session cookie.
  if (req.nextUrl.pathname === "/") return NextResponse.next();

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
   *  - `/api/auth/*` (Better Auth route handler — sign-in flow needs to hit this)
   *  - `/_next/*`, `/favicon`, `/static`, image-optimization, etc.
   *  - common public assets (extensions whitelisted)
   *
   *  Note: `/` is matched but allowed through inside the handler
   *  (above), since the chat landing needs to be public.
   */
  matcher: [
    "/((?!sign-in|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff2?)$).*)",
  ],
};
