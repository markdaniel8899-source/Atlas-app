import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./auth";

/**
 * Last signed-in user, persisted separately from the Supabase session.
 *
 * Supabase drops the in-memory session when the access token has expired and
 * the refresh request cannot reach the network (`getSession()` answers null).
 * Without a snapshot that cold offline start looked like a sign-out and the
 * login screen replaced the app. This snapshot keeps the profile, caches and
 * queued notes usable offline; it is cleared only on an explicit sign-out (or
 * when the account is reported disabled).
 *
 * Key: atlas.auth.user.v1
 */

const STORAGE_KEY = "atlas.auth.user.v1";

let memory: AuthUser | null = null;
let hydrated = false;
let hydrating: Promise<void> | null = null;
let epoch = 0;

/** Synchronous last known user (null until hydrateAuthSnapshot finishes). */
export function getAuthSnapshot(): AuthUser | null {
  return memory;
}

/** Loads the persisted snapshot into memory once per app run. */
export function hydrateAuthSnapshot(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const run = epoch;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (run !== epoch) return;
      if (raw && !memory) {
        const parsed = JSON.parse(raw) as AuthUser;
        if (
          parsed &&
          typeof parsed.id === "string" &&
          typeof parsed.email === "string"
        ) {
          memory = {
            id: parsed.id,
            email: parsed.email,
            name: typeof parsed.name === "string" ? parsed.name : "",
          };
        }
      }
    } catch {
      // Best-effort cache only.
    } finally {
      hydrated = true;
      hydrating = null;
    }
  })();
  return hydrating;
}

export function setAuthSnapshot(user: AuthUser): void {
  epoch += 1;
  memory = user;
  hydrated = true;
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user)).catch(
    () => {},
  );
}

export function clearAuthSnapshot(): void {
  epoch += 1;
  memory = null;
  hydrated = true;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
