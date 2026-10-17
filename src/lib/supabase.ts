import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured =
  /^https?:\/\//i.test(supabaseUrl) && supabaseAnonKey.length > 0;

/** Normalised project origin, used to allowlist user-supplied asset URLs. */
export const SUPABASE_ORIGIN = supabaseUrl.replace(/\/+$/, "");

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

const sessionStorage = {
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

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
