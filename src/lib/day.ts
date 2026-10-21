/**
 * Local day utilities — device-local YYYY-MM-DD for "today" decisions.
 * Server dates (timestamps, UTC) are never mutated; convert only for display
 * and for "did I study today" checks.
 */

/** Device-local day key (YYYY-MM-DD). */
export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** UTC day key (YYYY-MM-DD) — for server timestamps only. */
export function utcDayKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True if two dates fall on the same device-local day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return localDayKey(a) === localDayKey(b);
}

/** True if a date is the device-local "today". */
export function isLocalToday(date: Date): boolean {
  return isSameLocalDay(date, new Date());
}

/** Number of local-day boundaries between a and b (non-negative). */
export function daysBetweenLocal(a: Date, b: Date): number {
  const aLocal = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bLocal = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diffMs = bLocal.getTime() - aLocal.getTime();
  return Math.max(0, Math.round(diffMs / 86_400_000));
}