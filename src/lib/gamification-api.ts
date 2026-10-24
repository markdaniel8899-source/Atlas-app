import { markAccountDisabled } from "./account-guard";
import { supabase } from "./supabase";

/**
 * Thin client for the FastAPI gamification endpoints. Every call is
 * best-effort: Supabase stays the source of truth, so network failures
 * are swallowed.
 */

const RAW_BASE = process.env.EXPO_PUBLIC_AI_API_URL ?? "";
const AI_BASE_URL = RAW_BASE.replace(/\/+$/, "");
const TIMEOUT_MS = 15_000;

interface ApiResult {
  ok?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

/** Returns the parsed JSON body, or null on network/timeout failure. */
async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!AI_BASE_URL) return null;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      markAccountDisabled();
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      return {
        ok: false,
        error: payload?.detail ?? `Request failed (${response.status}).`,
      } as T;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Validates and stores a DiceBear avatar URL on the profile. */
export async function apiSelectAvatar(
  avatarUrl: string | null,
): Promise<ApiResult | null> {
  return postJson<ApiResult>("/api/avatar/select", { avatar_url: avatarUrl });
}
