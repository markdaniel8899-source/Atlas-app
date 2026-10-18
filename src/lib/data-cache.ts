/**
 * Tiny in-memory cache for list/query results. Screens seed their initial
 * state from here so switching tabs paints instantly while fresh data
 * revalidates in the background. Cleared on sign-out (see lib/auth.ts) so
 * one account's rows never leak into another's session.
 *
 * Keys are plain strings ("courses", "notes:12", "squad", ...).
 */

interface Entry {
  value: unknown;
  at: number;
}

const entries = new Map<string, Entry>();

/** Last known value, even if stale - for instant first paint. */
export function readCache<T>(key: string): T | null {
  const entry = entries.get(key);
  return entry ? (entry.value as T) : null;
}

/** Last known value only if written within maxAgeMs. */
export function readCacheFresh<T>(key: string, maxAgeMs: number): T | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > maxAgeMs) return null;
  return entry.value as T;
}

export function writeCache<T>(key: string, value: T): void {
  entries.set(key, { value, at: Date.now() });
}

export function clearDataCaches(): void {
  entries.clear();
}
