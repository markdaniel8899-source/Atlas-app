import { resolveSession } from "../auth";
import { isAllowedAvatarUrl } from "../dicebear";
import { setCachedProfile } from "../profile-cache";
import { supabase } from "../supabase";
import type { Profile } from "./types";

const PROFILE_COLUMNS =
  "id, username, display_name, streak, xp, level, avatar_url, last_active_date, weekly_xp, total_xp, day_streak";

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const profile = data as Profile;
  setCachedProfile(userId, profile);
  return profile;
}

export interface ProfileUpdateResult {
  profile: Profile | null;
  error: string | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "avatar_url" | "username">>,
): Promise<ProfileUpdateResult> {
  const me = await resolveSession();
  if (!me || me.id !== userId) {
    return { profile: null, error: "You need to sign in again." };
  }

  if (typeof patch.avatar_url === "string" && !isAllowedAvatarUrl(patch.avatar_url)) {
    return { profile: null, error: "That avatar source isn't allowed." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return { profile: null, error: "That username is already taken." };
    }
    return { profile: null, error: error.message };
  }
  if (!data) {
    return {
      profile: null,
      error: "Couldn't save your changes. Check your connection and try again.",
    };
  }
  const profile = data as Profile;
  setCachedProfile(userId, profile);
  return { profile, error: null };
}

/**
 * Global lifetime focus seconds for the signed-in user (profiles table).
 * Returns 0 when the row/column is missing and null when the counter could
 * not be read (offline) so callers can keep their local value.
 */
export async function getGlobalFocusSeconds(): Promise<number | null> {
  const user = await resolveSession();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("total_focus_seconds")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;
  if (!data) return 0;
  const value = Number(
    (data as { total_focus_seconds?: unknown }).total_focus_seconds,
  );
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

let rpcUnavailable = false;

/**
 * Add a delta to the global focus counter using atomic RPC.
 * Falls back to read-modify-write if the RPC is not available.
 */
export async function addGlobalFocusSeconds(seconds: number): Promise<boolean> {
  if (!Number.isFinite(seconds) || seconds < 1) return false;
  const user = await resolveSession();
  if (!user) return false;

  if (!rpcUnavailable) {
    try {
      const { error } = await supabase.rpc("increment_global_focus", {
        p_seconds: Math.floor(seconds),
      });
      if (!error) return true;
      // Check if function doesn't exist (PGRST202 / 42883)
      if (
        error.code === "PGRST202" ||
        error.message.includes("function") ||
        error.message.includes("does not exist")
      ) {
        rpcUnavailable = true;
      } else {
        return false;
      }
    } catch {
      // Transient network failure: let the caller queue/retry instead of
      // permanently disabling the atomic RPC for this app run.
      return false;
    }
  }

  // Fallback: read-modify-write
  const current = await getGlobalFocusSeconds();
  if (current == null) return false;
  const { error } = await supabase
    .from("profiles")
    .update({ total_focus_seconds: current + Math.floor(seconds) })
    .eq("id", user.id);

  return !error;
}
