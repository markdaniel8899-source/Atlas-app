import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Profile } from "./db/types";

/**
 * Remembers the signed-in user's profile row (memory + AsyncStorage) so the
 * header avatar and greeting paint instantly on every screen mount instead
 * of flashing the fallback icon while a fetch is in flight.
 *
 * Kept dependency-free on purpose (no auth / db imports) so it can be used
 * from auth.signOut and db/profile without import cycles.
 */

const STORAGE_KEY = "atlas.profile.cache.v1";
/** Entries older than this are revalidated against the server. */
export const PROFILE_CACHE_FRESH_MS = 5 * 60 * 1000;

interface CachedProfile {
  ownerId: string;
  profile: Profile;
  at: number;
}

let memory: CachedProfile | null = null;
let hydrated = false;

/** Synchronous read for the very first render (memory only). */
export function getCachedProfile(ownerId?: string | null): Profile | null {
  if (!memory) return null;
  if (ownerId && memory.ownerId !== ownerId) return null;
  return memory.profile;
}

/** Age of the cached entry in ms, or Infinity when nothing is cached. */
export function profileCacheAgeMs(): number {
  if (!memory) return Number.POSITIVE_INFINITY;
  return Date.now() - memory.at;
}

/** Loads the persisted snapshot into memory once per app run. */
export async function hydrateProfileCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw && !memory) {
      const parsed = JSON.parse(raw) as CachedProfile;
      if (parsed?.ownerId && parsed?.profile) memory = parsed;
    }
  } catch {
    // Best-effort cache only.
  }
}

export function setCachedProfile(ownerId: string, profile: Profile): void {
  memory = { ownerId, profile, at: Date.now() };
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory)).catch(
    () => {},
  );
}

export function clearProfileCache(): void {
  memory = null;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
