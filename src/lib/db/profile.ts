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
