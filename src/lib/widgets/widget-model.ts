import { getRankFromXP } from "../gamification";
import type { HeatmapDay, Profile } from "../db/types";
import type { Note } from "../notes";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import type { NotesWidgetData, WidgetNote } from "./notes-widget-data";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_MS = 86_400_000;
export const MAX_NOTES = 5;
const SNIPPET_LENGTH = 90;

/** UTC day key - the same convention the activity heatmap uses. */
export function utcDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Last 7 heatmap days (oldest first, today last) for the chart row. */
export function buildWeek(
  heatmap: HeatmapDay[],
  now = Date.now(),
): { week: WidgetWeekDay[]; todaySeconds: number } {
  const lookup = new Map<string, number>();
  for (const day of heatmap) {
    lookup.set(day.day, Math.max(0, Number(day.total_seconds) || 0));
  }
  const week: WidgetWeekDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * DAY_MS);
    week.push({
      label: WEEKDAY_LETTERS[date.getUTCDay()],
      seconds: lookup.get(utcDayKey(date)) ?? 0,
    });
  }
  return { week, todaySeconds: week[week.length - 1]?.seconds ?? 0 };
}

export function formatFocus(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function barHeight(seconds: number, max: number): number {
  if (seconds <= 0 || max <= 0) return 4;
  return 5 + Math.round(Math.min(1, seconds / max) * 17);
}

export function formatXp(xp: number): string {
  return String(Math.max(0, Math.floor(xp))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

/** Largest streak milestone reached (7, 14, 30...) for the badge chip. */
export function streakBadge(streak: number): string | null {
  if (streak <= 0) return null;
  const milestones = [7, 14, 21, 30, 50, 100, 200, 365];
  for (let index = milestones.length - 1; index >= 0; index -= 1) {
    if (streak >= milestones[index]) return `🔥 ${milestones[index]}-Day Streak`;
  }
  return `🔥 ${streak}-Day Streak`;
}

export function buildBadges(
  streak: number,
  rankName: string,
  weeklyXp: number,
): string[] {
  const badges: string[] = [];
  const streakMilestone = streakBadge(streak);
  if (streakMilestone) badges.push(streakMilestone);
  badges.push(`★ ${rankName}`);
  if (weeklyXp > 0) badges.push(`⚡ ${formatXp(weeklyXp)} wk XP`);
  return badges.slice(0, 3);
}

export function buildStatsData(
  profile: Profile,
  heatmap: HeatmapDay[],
  now = Date.now(),
): AtlasWidgetData {
  const xp = Math.max(0, Math.floor(profile.xp ?? 0));
  const weeklyXp = Math.max(0, Math.floor(profile.weekly_xp ?? 0));
  const streak = Math.max(0, Math.floor(profile.streak ?? 0));
  const rankName = getRankFromXP(xp).name;
  const { week, todaySeconds } = buildWeek(heatmap, now);
  return {
    streak,
    level: Math.max(1, Math.floor(profile.level ?? 1)),
    xp,
    rankName,
    weeklyXp,
    todaySeconds,
    week,
    badges: buildBadges(streak, rankName, weeklyXp),
  };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function relativeTime(updatedAt: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function toWidgetNote(
  note: Note,
  now = Date.now(),
): {
  id: string;
  title: string;
  snippet: string;
  timeLabel: string;
} {
  return {
    id: note.id,
    title: note.title || "Untitled note",
    snippet: stripHtml(note.html).slice(0, SNIPPET_LENGTH),
    timeLabel: relativeTime(note.updatedAt, now),
  };
}

/** Sorted, capped notes snapshot used by both notes widgets. */
export function buildNotesWidgetData(
  notes: Note[],
  now = Date.now(),
): NotesWidgetData {
  return {
    notes: notes
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_NOTES)
      .map((note) => toWidgetNote(note, now)) as WidgetNote[],
  };
}
