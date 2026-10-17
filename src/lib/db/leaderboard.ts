import { resolveSession } from "../auth";
import { supabase } from "../supabase";

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  username: string;
  initials: string;
  avatarUrl: string | null;
  weeklyXp: number;
  totalXp: number;
  streak: number;
  level: number;
  isYou: boolean;
}

interface ProfileRow {
  id: string;
  display_name: string;
  username: string;
  weekly_xp: number;
  xp: number;
  streak: number;
  level: number;
  avatar_url: string | null;
}

const COLUMNS =
  "id, display_name, username, weekly_xp, xp, streak, level, avatar_url";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toEntry(row: ProfileRow, isYou: boolean): LeaderboardEntry {
  const displayName = row.display_name.trim() || row.username;
  return {
    id: row.id,
    displayName,
    username: row.username,
    initials: initialsOf(displayName),
    avatarUrl: row.avatar_url,
    weeklyXp: row.weekly_xp ?? 0,
    totalXp: row.xp ?? 0,
    streak: row.streak ?? 0,
    level: row.level ?? 1,
    isYou,
  };
}

export interface WeeklyLeaderboardResult {
  /** False when the fetch failed (offline / server error) - not an empty board. */
  ok: boolean;
  entries: LeaderboardEntry[];
}

/**
 * Global weekly board: everyone ordered by weekly XP (Monday reset).
 * The signed-in learner is always present, even outside the top window.
 */
export async function fetchWeeklyLeaderboard(
  limit = 50,
): Promise<WeeklyLeaderboardResult> {
  const me = await resolveSession();

  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .order("weekly_xp", { ascending: false })
    .order("xp", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return { ok: false, entries: [] };

  const rows = data as unknown as ProfileRow[];
  const entries = rows.map((row) => toEntry(row, row.id === me?.id));

  if (me && !entries.some((entry) => entry.id === me.id)) {
    const { data: mine } = await supabase
      .from("profiles")
      .select(COLUMNS)
      .eq("id", me.id)
      .maybeSingle();
    if (mine) entries.push(toEntry(mine as unknown as ProfileRow, true));
  }

  return { ok: true, entries };
}
