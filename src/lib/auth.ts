import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  error?: string;
  /** Sign up succeeded but the address still needs confirming by email. */
  needsConfirmation?: boolean;
}

export const CONFIG_ERROR =
  "Supabase isn't configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.";

let cached: AuthUser | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cached = session?.user ? toAuthUser(session.user) : null;
});

/** Synchronous read of the cached user; populated by resolveSession(). */
export function getUser(): AuthUser | null {
  return cached;
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

function readableError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) {
    return "That email and password combination didn't work.";
  }
  if (m.includes("already registered")) {
    return "An account with this email already exists.";
  }
  if (m.includes("at least") && m.includes("password")) {
    return "Passwords must be at least 6 characters long.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first, then sign in.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts. Give it a moment and try again.";
  }
  return message;
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { error: CONFIG_ERROR };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return { error: readableError(error.message) };

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: readableError(error.message) };

  if (data.user) cached = toAuthUser(data.user);
  return {};
}

export async function signOut(): Promise<void> {
  cached = null;
  if (isSupabaseConfigured) await supabase.auth.signOut();
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
