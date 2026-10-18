import { Platform } from "react-native";
import { getRankFromXP } from "../gamification";
import type { HeatmapDay, Profile } from "../db/types";
import type { Note } from "../notes";
import {
  FALLBACK_WIDGET_DATA,
  saveAtlasWidgetData,
} from "./atlas-widget-data";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import {
  EMPTY_NOTES_WIDGET_DATA,
  loadStickyNoteIndex,
  saveNotesWidgetData,
} from "./notes-widget-data";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_MS = 86_400_000;
const MAX_NOTES = 5;
const SNIPPET_LENGTH = 90;

/** UTC day key - the same convention the activity heatmap uses. */
function utcDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Last 7 heatmap days (oldest first, today last) for the chart row. */
function buildWeek(heatmap: HeatmapDay[]): {
  week: WidgetWeekDay[];
  todaySeconds: number;
} {
  const lookup = new Map<string, number>();
  for (const day of heatmap) {
    lookup.set(day.day, Math.max(0, Number(day.total_seconds) || 0));
  }
  const week: WidgetWeekDay[] = [];
  const now = Date.now();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * DAY_MS);
    week.push({
      label: WEEKDAY_LETTERS[date.getUTCDay()],
      seconds: lookup.get(utcDayKey(date)) ?? 0,
    });
  }
  return { week, todaySeconds: week[week.length - 1]?.seconds ?? 0 };
}

function formatXp(xp: number): string {
  return String(Math.max(0, Math.floor(xp))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

/** Largest streak milestone reached (7, 14, 30...) for the badge chip. */
function streakBadge(streak: number): string | null {
  if (streak <= 0) return null;
  const milestones = [7, 14, 21, 30, 50, 100, 200, 365];
  for (let index = milestones.length - 1; index >= 0; index -= 1) {
    if (streak >= milestones[index]) return `🔥 ${milestones[index]}-Day Streak`;
  }
  return `🔥 ${streak}-Day Streak`;
}

function buildBadges(
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

function buildStatsData(
  profile: Profile,
  heatmap: HeatmapDay[],
): AtlasWidgetData {
  const xp = Math.max(0, Math.floor(profile.xp ?? 0));
  const weeklyXp = Math.max(0, Math.floor(profile.weekly_xp ?? 0));
  const streak = Math.max(0, Math.floor(profile.streak ?? 0));
  const rankName = getRankFromXP(xp).name;
  const { week, todaySeconds } = buildWeek(heatmap);
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

/**
 * Mirrors the latest dashboard snapshot into the stats widget cache.
 * Pass null when signed out so the widget never leaks one account's stats
 * to the next viewer. No-ops on binaries without the widget module.
 */
export function syncAtlasStatsWidget(
  profile: Profile | null,
  heatmap: HeatmapDay[],
): void {
  const data = profile ? buildStatsData(profile, heatmap) : FALLBACK_WIDGET_DATA;
  void saveAtlasWidgetData(data);
  if (Platform.OS !== "android") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
    const updater = require("./widget-update") as typeof import("./widget-update");
    updater.pushAtlasStatsWidgetUpdate(data);
  } catch {
    // Widget native module missing (older APK) - skip silently.
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relativeTime(updatedAt: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - updatedAt) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function toWidgetNote(note: Note): {
  id: string;
  title: string;
  snippet: string;
  timeLabel: string;
} {
  return {
    id: note.id,
    title: note.title || "Untitled note",
    snippet: stripHtml(note.html).slice(0, SNIPPET_LENGTH),
    timeLabel: relativeTime(note.updatedAt),
  };
}

/**
 * Mirrors the newest notes into the sticky + quick-notes widget caches.
 * Pass null on sign-out so both widgets fall back to their empty states.
 */
export function syncAtlasNotesWidget(notes: Note[] | null): void {
  const data =
    notes === null
      ? EMPTY_NOTES_WIDGET_DATA
      : {
          notes: notes
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_NOTES)
            .map(toWidgetNote),
        };
  void saveNotesWidgetData(data);
  if (Platform.OS !== "android") return;
  void (async () => {
    try {
      const index = await loadStickyNoteIndex();
      const note =
        data.notes.length > 0 ? data.notes[index % data.notes.length] : null;
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
      const updater = require("./widget-update") as typeof import("./widget-update");
      updater.pushStickyWidgetUpdate(note);
      updater.pushNotesWidgetUpdate(data);
    } catch {
      // Widget native module missing (older APK) - skip silently.
    }
  })();
}
