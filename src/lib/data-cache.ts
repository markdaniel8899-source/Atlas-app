/**
 * Owner-scoped cache for list/query results. Screens seed their initial state
 * from here so switching tabs paints instantly while fresh data revalidates.
 *
 * Entries live in memory for the session and are mirrored to AsyncStorage
 * (one JSON blob per account) so a cold start without a network still paints
 * courses, leaderboard, friends, roadmaps, etc. The blob is hydrated before
 * the navigator mounts (see app/_layout.tsx) and removed on sign-out, so one
 * account's rows never leak into another's session.
 *
 * Keys are plain strings ("courses", "notes:12", "squad", ...).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

interface Entry {
  value: unknown;
  at: number;
}

const STORAGE_PREFIX = "atlas.data.cache.v1";
const PERSIST_DELAY_MS = 400;

const entries = new Map<string, Entry>();

let currentOwner: string | null = null;
let hydrated = false;
let hydrating: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

/**
 * Loads the persisted blob for `ownerId` into memory. Safe to call more than
 * once: later calls reuse the in-flight read or return immediately.
 */
export function hydrateDataCaches(ownerId: string): Promise<void> {
  if (ownerId === currentOwner && hydrated) return Promise.resolve();
  if (ownerId === currentOwner && hydrating) return hydrating;

  if (ownerId !== currentOwner) {
    entries.clear();
    hydrated = false;
  }
  currentOwner = ownerId;

  const ownerAtStart = ownerId;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey(ownerAtStart));
      if (ownerAtStart !== currentOwner) return;
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const now = Date.now();
        for (const [key, value] of Object.entries(parsed)) {
          // Fresh data written while hydrating wins over the stored blob.
          if (!entries.has(key)) entries.set(key, { value, at: now });
        }
      }
    } catch {
      // A corrupt cache is not fatal; screens fall back to fetching.
    } finally {
      if (ownerAtStart === currentOwner) {
        hydrated = true;
        hydrating = null;
      }
    }
  })();
  return hydrating;
}

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

function schedulePersist(): void {
  if (!currentOwner) return;
  const ownerAtWrite = currentOwner;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (ownerAtWrite !== currentOwner) return;
    const blob: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      // Notes already have their own per-scope persistent cache; persisting
      // them twice would only double the disk footprint.
      if (key.startsWith("notes:")) continue;
      blob[key] = entry.value;
    }
    void AsyncStorage.setItem(
      storageKey(ownerAtWrite),
      JSON.stringify(blob),
    ).catch(() => {});
  }, PERSIST_DELAY_MS);
}

export function writeCache<T>(key: string, value: T): void {
  entries.set(key, { value, at: Date.now() });
  schedulePersist();
}

/**
 * Clears the in-memory cache and removes the persisted blob for `ownerId`
 * (or for the owner that was active when no id is passed).
 */
export function clearDataCaches(ownerId?: string | null): void {
  const target = ownerId ?? currentOwner;
  entries.clear();
  hydrated = false;
  hydrating = null;
  currentOwner = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (target) {
    void AsyncStorage.removeItem(storageKey(target)).catch(() => {});
  }
}
