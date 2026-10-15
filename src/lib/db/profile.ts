import { resolveSession } from "../auth";
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
  return data as Profile;
}

/**
 * Global lifetime focus seconds for the signed-in user (profiles table).
 * Returns 0 when signed out, missing, or the column has not been migrated.
 */
export async function getGlobalFocusSeconds(): Promise<number> {
  const user = await resolveSession();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("profiles")
    .select("total_focus_seconds")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return 0;
  const value = Number(
    (data as { total_focus_seconds?: unknown }).total_focus_seconds,
  );
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Add a delta to the global focus counter. Serialized by the caller
 * (see db/focus.ts) so pause/resume cycles cannot lose an update.
 */
export async function addGlobalFocusSeconds(seconds: number): Promise<boolean> {
  if (!Number.isFinite(seconds) || seconds < 1) return false;
  const user = await resolveSession();
  if (!user) return false;

  const current = await getGlobalFocusSeconds();
  const { error } = await supabase
    .from("profiles")
    .update({ total_focus_seconds: current + Math.floor(seconds) })
    .eq("id", user.id);

  return !error;
}
