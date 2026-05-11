/**
 * Centralized bound checks for bounded fields.
 *
 * Convex schema validators (`v.number()`) accept any finite number;
 * domain bounds (≥0, ≤100, etc.) live in the application layer. Reuse
 * these from every mutation so a bad value can't reach the DB.
 *
 * Throws with a precise message so the UI's toast.promise renders
 * something readable.
 */

export function checkNonNegative(label: string, n: number): number {
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number`);
  if (n < 0) throw new Error(`${label} must be ≥ 0`);
  return n;
}

export function checkPercent(label: string, n: number): number {
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number`);
  if (n < 0 || n > 100) throw new Error(`${label} must be 0–100`);
  return n;
}

export function checkInteger(label: string, n: number): number {
  if (!Number.isInteger(n)) throw new Error(`${label} must be an integer`);
  return n;
}

export function checkSlug(label: string, s: string): string {
  if (typeof s !== "string" || s.length === 0) {
    throw new Error(`${label} cannot be empty`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) {
    throw new Error(`${label} must be lowercase alnum + dashes`);
  }
  return s;
}
