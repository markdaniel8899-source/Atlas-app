import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Storage adapter for the Supabase session. Lives in its own dependency-free
 * module so the headless background task can read the stored access token
 * without instantiating the Supabase client (which would start a token
 * refresh ticker in a second JS context).
 */

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();

/**
 * Same key supabase-js derives internally (`sb-<projectRef>-auth-token`).
 * Pinned explicitly on the client so both contexts always agree.
 */
export const SUPABASE_SESSION_KEY = (() => {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : "sb-atlas-auth-token";
  } catch {
    return "sb-atlas-auth-token";
  }
})();

// AsyncStorage touches window/localStorage, which do not exist when this
// module is evaluated in Node (web SSR / prerender). Fall back to memory.
const memoryFallback = new Map<string, string>();

async function plainGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function plainSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

async function plainRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

// -- Secure, chunked session storage ----------------------------------------
// The Supabase session (refresh token) belongs in the OS keystore, not in
// plain AsyncStorage. Session JWTs exceed SecureStore's per-value size limit,
// so values are split into chunks; a chunk-count pointer is written last, so
// a torn write reads back as absent instead of corrupt. Platforms without a
// keystore (web/Node) fall back to plain storage as before.

const CHUNK_SIZE = 1800;
const metaKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;
const SECURE_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

let secureStoreUsable: Promise<boolean> | null = null;
function canUseSecureStore(): Promise<boolean> {
  if (!secureStoreUsable) {
    secureStoreUsable =
      Platform.OS === "web"
        ? Promise.resolve(false)
        : SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreUsable;
}

async function secureGet(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(metaKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  if (!Number.isFinite(count) || count <= 0) {
    return SecureStore.getItemAsync(key);
  }
  let out = "";
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null;
    out += part;
  }
  return out;
}

async function secureSet(key: string, value: string): Promise<void> {
  const previousRaw = await SecureStore.getItemAsync(metaKey(key));
  const previous = previousRaw ? Number.parseInt(previousRaw, 10) : 0;
  const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < count; i += 1) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      SECURE_OPTS,
    );
  }
  await SecureStore.setItemAsync(metaKey(key), String(count), SECURE_OPTS);
  for (let i = count; i < previous; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => undefined);
  }
}

async function secureRemove(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(metaKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(metaKey(key)).catch(() => undefined);
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export const sessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (await canUseSecureStore()) {
      try {
        const secure = await secureGet(key);
        if (secure != null) return secure;
        // Migrate a session persisted before SecureStore was in use.
        const legacy = await plainGet(key);
        if (legacy != null) {
          await secureSet(key, legacy);
          await plainRemove(key);
        }
        return legacy;
      } catch {
        // fall through to plain storage
      }
    }
    return plainGet(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (await canUseSecureStore()) {
      try {
        await secureSet(key, value);
        await plainRemove(key);
        return;
      } catch {
        // fall through to plain storage
      }
    }
    await plainSet(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (await canUseSecureStore()) {
      try {
        await secureRemove(key);
      } catch {
        // plain copy is cleared below regardless
      }
    }
    await plainRemove(key);
  },
};

export interface StoredSession {
  access_token?: string;
  refresh_token?: string;
  /** Unix seconds (Supabase convention). */
  expires_at?: number;
  user?: { id?: string } | null;
}

/**
 * Reads the persisted session without touching the Supabase client. Returns
 * null when nothing is stored or the payload is unreadable.
 */
export async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await sessionStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}
