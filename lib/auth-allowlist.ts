/**
 * Email allowlist for Castle. Anyone whose GitHub primary email
 * matches one of these patterns can sign in; everyone else is rejected
 * server-side in the Better Auth user-create hook AND blocked from
 * accessing protected routes by `middleware.ts`.
 *
 * Match rules:
 *  - exact email match (case-insensitive)
 *  - or domain match: `@<domain>` lower-cased
 */
const EXACT = new Set(["jerry.x0930@gmail.com", "ayaangazali.work@gmail.com"]);
const DOMAINS = new Set(["xiao.sh", "42nights.dev"]);

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@")) return false;
  if (EXACT.has(e)) return true;
  const domain = e.split("@")[1] ?? "";
  return DOMAINS.has(domain);
}

export const ALLOWLIST_DESCRIPTION =
  "Castle is restricted to 42nights operators. " +
  "Sign in with a @xiao.sh, @42nights.dev address, or jerry.x0930@gmail.com / ayaangazali.work@gmail.com.";
