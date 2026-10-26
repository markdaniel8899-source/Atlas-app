import type { User } from "@supabase/supabase-js";
import {
  isDisabledAccountMessage,
  markAccountDisabled,
} from "./account-guard";
import { clearDataCaches } from "./data-cache";
import { isSupabaseConfigured, supabase } from "./supabase";
import { clearLocalTimerCache } from "./timer";
import {
  cancelSessionEndNotification,
  cancelStreakReminder,
} from "./notifications";
import { clearProfileCache } from "./profile-cache";
import { runResetHandlers } from "./session-reset";
import {
  syncAtlasNotesWidget,
  syncAtlasStatsWidget,
} from "./widgets/widget-sync";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  error?: string;
  /** Sign up succeeded but the address still needs confirming by email. */
  needsConfirmation?: boolean;
  /** Sign in was blocked because the email still needs confirming. */
  unverifiedEmail?: boolean;
}

export const CONFIG_ERROR =
  "Supabase isn't configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.";

let cached: AuthUser | null = null;
let lastAuthId: string | null | undefined;

supabase.auth.onAuthStateChange((_event, session) => {
  cached = session?.user ? toAuthUser(session.user) : null;
  const nextId = session?.user?.id ?? null;
  // Reset once the account actually changes; the initial session event only
  // establishes the baseline. Registered first, so stores are cleared before
  // screen subscribers see the new user.
  if (lastAuthId !== undefined && lastAuthId !== nextId) {
    runResetHandlers();
  }
  lastAuthId = nextId;
});

/** Subscribe to sign-in / sign-out (fires with null after sign-out). */
export function subscribeAuth(
  listener: (user: AuthUser | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session?.user ? toAuthUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

export function toAuthUser(user: User): AuthUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const given =
    typeof meta.name === "string"
      ? meta.name.trim()
      : typeof meta.full_name === "string"
        ? meta.full_name.trim()
        : "";
  const fallback = (user.email ?? "").split("@")[0].replace(/[._-]+/g, " ");
  return {
    id: user.id,
    email: user.email ?? "",
    name: given || fallback || "Explorer",
  };
}
const NETWORK_ERROR_RE =
  /unknownhost|fetch failed|network request failed|enotfound|timed out|timeout/i;

/** Retries once when a request fails at the network/DNS layer. */
async function withRetry<T extends { error: { message: string } | null }>(
  call: () => Promise<T>,
): Promise<T> {
  let result = await call();
  if (result.error && NETWORK_ERROR_RE.test(result.error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    result = await call();
  }
  return result;
}

function readableError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("unknownhost") ||
    m.includes("fetch failed") ||
    m.includes("network request failed") ||
    m.includes("enotfound") ||
    m.includes("timed out") ||
    m.includes("timeout")
  ) {
    return "No internet connection - check your network and try again.";
  }
  if (m.includes("invalid login")) {
    return "That email and password combination didn't work.";
  }
  if (m.includes("already registered")) {
    return "An account with this email already exists.";
  }
  if (m.includes("at least") && m.includes("password")) {
    return "Passwords must be at least 8 characters long.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first, then sign in.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts. Give it a moment and try again.";
  }
  if (m.includes("only request this after")) {
    return "Please wait a moment before requesting another code.";
  }
  if (m.includes("expired") || m.includes("invalid")) {
    if (m.includes("token") || m.includes("otp")) {
      return "That code is wrong or has expired. Request a new one.";
    }
  }
  if (m.includes("different from the old password")) {
    return "Pick a password you haven't used before.";
  }
  if (m.includes("signups not allowed for otp")) {
    return "No ATLAS account uses that email yet. Create an account instead.";
  }
  if (isDisabledAccountMessage(m)) {
    return "This account has been disabled. Contact support if you think this is a mistake.";
  }
  return message;
}

function flagDisabledAccount(message: string): void {
  if (isDisabledAccountMessage(message)) markAccountDisabled();
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { data, error } = await withRetry(() =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }

  // Supabase returns an obfuscated user with no identities when the address
  // is already registered and email enumeration protection is on.
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return { error: "An account with this email already exists." };
  }

  if (data.session && data.user) {
    cached = toAuthUser(data.user);
    return {};
  }

  return { needsConfirmation: true };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { data, error } = await withRetry(() =>
    supabase.auth.signInWithPassword({
      email,
      password,
    }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return {
      error: readableError(error.message),
      unverifiedEmail: error.message.toLowerCase().includes("email not confirmed"),
    };
  }

  if (data.user) cached = toAuthUser(data.user);
  return {};
}

/**
 * Emails an 8-digit sign-in code. Existing accounts only - signing in must
 * never silently create a new user.
 */
export async function requestEmailSignInCode(
  email: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { error } = await withRetry(() =>
    supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }
  return {};
}

/**
 * Verifies the 8-digit email code from Supabase - a sign-in code, the signup
 * confirmation code, or the password-recovery code.
 */
export async function verifyEmailOtp(
  email: string,
  token: string,
  type: "email" | "signup" | "recovery",
): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { data, error } = await withRetry(() =>
    supabase.auth.verifyOtp({ email, token, type }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }

  if (data.user) cached = toAuthUser(data.user);
  return {};
}

/** Re-sends the signup confirmation code to the address. */
export async function resendConfirmationOtp(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { error } = await withRetry(() =>
    supabase.auth.resend({ type: "signup", email }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }
  return {};
}

/** Emails a password-recovery code via Supabase. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { error } = await withRetry(() =>
    supabase.auth.resetPasswordForEmail(email),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }
  return {};
}

/** Sets a new password for the recovery session (or the signed-in user). */
export async function updatePassword(password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { data, error } = await withRetry(() =>
    supabase.auth.updateUser({ password }),
  );

  if (error) {
    flagDisabledAccount(error.message);
    return { error: readableError(error.message) };
  }

  if (data.user) cached = toAuthUser(data.user);
  return {};
}

export async function signOut(
  options: { local?: boolean } = {},
): Promise<void> {
  const ownerId = cached?.id ?? null;
  cached = null;
  try {
    if (isSupabaseConfigured) {
      if (options.local) {
        await supabase.auth.signOut({ scope: "local" });
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) await supabase.auth.signOut({ scope: "local" });
      }
    }
  } catch {
    // Local sign-out must still complete when the network is unavailable.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Nothing else to clear; the in-memory cache is already gone.
    }
  } finally {
    await clearLocalTimerCache(ownerId);
    void cancelSessionEndNotification();
    void cancelStreakReminder();
    syncAtlasStatsWidget(null, []);
    syncAtlasNotesWidget(null);
    clearProfileCache();
    clearDataCaches();
    runResetHandlers();
  }
}

/** Restores the persisted session on load and refreshes the cached user. */
export async function resolveSession(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured) {
    cached = null;
    return null;
  }

  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;

  cached = sessionUser ? toAuthUser(sessionUser) : null;
  return cached;
}

/**
 * Last known session user (null before the first resolve). Lets screen
 * chrome render immediately on navigation instead of popping in after an
 * async session read.
 */
export function getCachedAuthUser(): AuthUser | null {
  return cached;
}
