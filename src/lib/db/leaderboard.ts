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
  /** The signed-in learner, even when they are outside the fetched top N. */
  you: LeaderboardEntry | null;
  /** Server-derived position (count of higher weekly XP + 1). */
  yourRank: number | null;
}

/**
 * Global weekly board: everyone ordered by weekly XP (Monday reset).
 * Top N rows only; the signed-in learner is returned separately with their
 * true rank instead of being appended as a fake last row.
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

  if (error || !Array.isArray(data)) {
    return { ok: false, entries: [], you: null, yourRank: null };
  }

  const rows = data as unknown as ProfileRow[];
  const entries = rows.map((row) => toEntry(row, row.id === me?.id));

  let mine = me ? rows.find((row) => row.id === me.id) ?? null : null;
  if (me && !mine) {
    const { data: myRow } = await supabase
      .from("profiles")
      .select(COLUMNS)
      .eq("id", me.id)
      .maybeSingle();
    mine = (myRow as unknown as ProfileRow | null) ?? null;
  }

  let yourRank: number | null = null;
  if (me && mine) {
    const weeklyXp = Number(mine.weekly_xp) || 0;
    const totalXp = Number(mine.xp) || 0;
    const { count, error: rankError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or(
        `weekly_xp.gt.${weeklyXp},and(weekly_xp.eq.${weeklyXp},xp.gt.${totalXp})`,
      );
    if (!rankError && typeof count === "number") {
      yourRank = count + 1;
    } else {
      // Best available fallback: position inside the fetched top N.
      const index = entries.findIndex((entry) => entry.isYou);
      yourRank = index >= 0 ? index + 1 : null;
    }
  }

  return {
    ok: true,
    entries,
    you: mine ? toEntry(mine, true) : null,
    yourRank,
  };
}
