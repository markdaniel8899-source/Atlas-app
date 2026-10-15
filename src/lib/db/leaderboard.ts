import { supabase } from '@/lib/supabase';

import type { LeaderboardEntry } from './types';

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
  'id, display_name, username, weekly_xp, xp, streak, level, avatar_url';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
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

export async function fetchWeeklyLeaderboard(
  userId: string | null,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .order('weekly_xp', { ascending: false })
    .order('xp', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];

  const rows = data as unknown as ProfileRow[];
  const entries = rows.map((row) => toEntry(row, row.id === userId));

  if (userId && !entries.some((entry) => entry.id === userId)) {
    const { data: mine } = await supabase
      .from('profiles')
      .select(COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    if (mine) entries.push(toEntry(mine as unknown as ProfileRow, true));
  }

  return entries;
}

export async function fetchMyWeeklyRank(userId: string | null): Promise<number | null> {
  if (!supabase || !userId) return null;

  const { data: mine } = await supabase
    .from('profiles')
    .select('weekly_xp, xp')
    .eq('id', userId)
    .maybeSingle();
  if (!mine) return null;

  const weekly = (mine as { weekly_xp: number }).weekly_xp ?? 0;
  const total = (mine as { xp: number }).xp ?? 0;

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(
      `weekly_xp.gt.${weekly},and(weekly_xp.eq.${weekly},xp.gt.${total})`,
    );

  return (count ?? 0) + 1;
}
