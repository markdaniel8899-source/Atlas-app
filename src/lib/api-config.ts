import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const CACHE_KEY = "atlas.cfg.ai_url";
const FALLBACK_URL = process.env.EXPO_PUBLIC_AI_API_URL ?? "";
const FETCH_TIMEOUT_MS = 4_000;

let memoryUrl: string | null = null;
let cacheLoaded = false;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/\s/.test(value);
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function loadFromCache(): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached && isValidUrl(cached)) return normalizeUrl(cached);
  } catch {
    // ignore
  }
  return null;
}

async function saveToCache(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, url);
  } catch {
    // ignore
  }
}

export function getAiBaseUrl(): string {
  if (memoryUrl) return memoryUrl;
  if (!cacheLoaded) {
    cacheLoaded = true;
    void loadFromCache().then((url) => {
      if (url) memoryUrl = url;
    });
  }
  return FALLBACK_URL;
}

export async function refreshAiBaseUrl(): Promise<void> {
  let didFetch = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ai_api_url")
      .maybeSingle();

    clearTimeout(timer);
    didFetch = true;

    if (!error && data?.value && isValidUrl(data.value)) {
      const normalized = normalizeUrl(data.value);
      memoryUrl = normalized;
      await saveToCache(normalized);
    }
  } catch {
    if (!didFetch) {
      // keep current value silently
    }
  }
}

export function clearAiBaseUrlCache(): void {
  memoryUrl = null;
  cacheLoaded = false;
  void AsyncStorage.removeItem(CACHE_KEY);
}