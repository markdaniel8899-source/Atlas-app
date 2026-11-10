import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import {
  isDisabledAccountMessage,
  markAccountDisabled,
} from "./account-guard";
import { SUPABASE_SESSION_KEY, sessionStorage } from "./session-store";

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured =
  /^https?:\/\//i.test(supabaseUrl) && supabaseAnonKey.length > 0;

/** Normalised project origin, used to allowlist user-supplied asset URLs. */
export const SUPABASE_ORIGIN = supabaseUrl.replace(/\/+$/, "");

function headerValue(
  headers: HeadersInit | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(target);
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === target);
    return pair ? pair[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((item) => item.toLowerCase() === target);
  return key ? record[key] : null;
}

function requestPath(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : typeof Request !== "undefined" && input instanceof Request
          ? input.url
          : "";
  try {
    return new URL(raw).pathname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    return [body.msg, body.message, body.error_description, body.error]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  } catch {
    return "";
  }
}

/**
 * Flags an account only when the server explicitly reports a banned/disabled
 * user. A bare 401/403 usually means an expired access token or a failed
 * offline refresh, and treating it as a disabled account would cover the app
 * with the wrong overlay. Supabase auth endpoints are excluded (an invalid OTP
 * is a 403 too), except the token endpoint when GoTrue explicitly reports a
 * banned/disabled user.
 */
const guardedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  // If the access token expired mid-flight, refresh it once and retry the
  // original request so the user isn't thrown back to login every ~1 hour.
  if (response.status === 401) {
    const path = requestPath(input);
    const isAuth = path.includes("/auth/v1");
    if (!isAuth) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (data.session && !error) {
          const newHeaders = new Headers(init?.headers);
          newHeaders.set("Authorization", `Bearer ${data.session.access_token}`);
          const retryResponse = await fetch(input, {
            ...init,
            headers: newHeaders,
          });
          return retryResponse;
        }
      } catch {
        // Refresh failed - fall through to return the original 401 response.
      }
    }
  }

  try {
    if (response.status !== 401 && response.status !== 403) return response;

    const path = requestPath(input);
    const isAuth = path.includes("/auth/v1");
    if (isAuth) {
      if (path.includes("/auth/v1/verify") || path.includes("/auth/v1/otp")) {
        return response;
      }
      if (path.includes("/auth/v1/token")) {
        if (isDisabledAccountMessage(await errorText(response))) {
          markAccountDisabled();
        }
      }
      return response;
    }

    const authorization = headerValue(
      init?.headers ??
        (typeof Request !== "undefined" && input instanceof Request
          ? input.headers
          : undefined),
      "authorization",
    );
    const token = authorization?.replace(/^bearer\s+/i, "").trim() ?? "";
    if (!token || token === supabaseAnonKey) return response;

    if (isDisabledAccountMessage(await errorText(response))) {
      markAccountDisabled();
    }
  } catch {
    // Never let the guard change the response the SDK sees.
  }

  return response;
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: sessionStorage,
      storageKey: SUPABASE_SESSION_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: guardedFetch,
    },
  },
);
