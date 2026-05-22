/**
 * Email allowlist for Castle.
 *
 * Patterns can be either:
 *   - a full email: "user@example.com"   (exact, case-insensitive)
 *   - a domain wildcard: "*@example.com" (any local-part on that domain)
 *
 * The dynamic list lives in the Convex `email_allowlist` table and is
 * managed from /settings/access. The RESCUE_PATTERNS below are merged
 * on every check so we can never lock ourselves out by clearing the
 * table or losing Convex connectivity.
 */
const RESCUE_PATTERNS: readonly string[] = [
  "jerry.x0930@gmail.com",
  "ayaangazali.work@gmail.com",
  "*@xiao.sh",
  "*@42nights.dev",
];

export function matchesPattern(
  email: string | null | undefined,
  pattern: string,
): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@")) return false;
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p.startsWith("*@")) {
    const dom = p.slice(2);
    if (!dom) return false;
    return e.endsWith(`@${dom}`);
  }
  return e === p;
}

export function isEmailAllowedAgainst(
  email: string | null | undefined,
  patterns: readonly string[],
): boolean {
  if (!email) return false;
  const combined = [...patterns, ...RESCUE_PATTERNS];
  return combined.some((p) => matchesPattern(email, p));
}

/**
 * Validate that a user-entered pattern is well-formed before storing
 * it. Throws with a human-readable reason on bad input.
 */
export function validatePattern(raw: string): string {
  const p = raw.trim().toLowerCase();
  if (!p) throw new Error("Pattern cannot be empty.");
  if (p.includes(" ")) throw new Error("Pattern cannot contain spaces.");
  if (p.startsWith("*@")) {
    const dom = p.slice(2);
    if (!dom.includes(".")) {
      throw new Error("Domain wildcard needs a real domain, e.g. *@example.com");
    }
    return p;
  }
  if (!p.includes("@") || p.startsWith("@") || p.endsWith("@")) {
    throw new Error(
      "Use a full email (user@example.com) or a domain wildcard (*@example.com).",
    );
  }
  return p;
}

/**
 * Legacy hardcoded check kept for the Better Auth hook fallback path
 * (used only if the dynamic Convex query fails). Combines exact and
 * domain rescue patterns into a single boolean.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  return isEmailAllowedAgainst(email, []);
}

export const ALLOWLIST_DESCRIPTION =
  "Castle access is gated by an email allowlist. Sign in with an " +
  "allowlisted address, or ask an operator to add you at /settings/access.";

export const RESCUE_ALLOWLIST = RESCUE_PATTERNS;
