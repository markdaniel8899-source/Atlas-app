import AsyncStorage from "@react-native-async-storage/async-storage";

/** Registered widget name - must match app.json (config plugin). */
export const ATLAS_WIDGET_NAME = "AtlasWidget";

/** One bar of the 7-day focus chart (oldest first, today last). */
export interface WidgetWeekDay {
  /** Weekday letter shown under the bar (S, M, T...). */
  label: string;
  seconds: number;
}

export interface AtlasWidgetData {
  streak: number;
  level: number;
  xp: number;
  rankName: string;
  weeklyXp: number;
  todaySeconds: number;
  week: WidgetWeekDay[];
  badges: string[];
}

export const FALLBACK_WIDGET_DATA: AtlasWidgetData = {
  streak: 0,
  level: 1,
  xp: 0,
  rankName: "Bronze I",
  weeklyXp: 0,
  todaySeconds: 0,
  week: [],
  badges: [],
};

const CACHE_KEY = "atlas.widget.data.v1";

let memory: AtlasWidgetData | null = null;

/** Last dashboard snapshot for the home-screen widget (cache-first). */
export async function loadAtlasWidgetData(): Promise<AtlasWidgetData> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      // Merge so caches written by older widget versions stay renderable.
      const parsed = JSON.parse(raw) as Partial<AtlasWidgetData>;
      memory = {
        ...FALLBACK_WIDGET_DATA,
        ...parsed,
        week: Array.isArray(parsed.week) ? parsed.week : [],
        badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      };
    }
  } catch {
    // Falls back to the placeholder card.
  }
  return memory ?? FALLBACK_WIDGET_DATA;
}

export async function saveAtlasWidgetData(
  data: AtlasWidgetData,
): Promise<void> {
  memory = data;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Best-effort cache only.
  }
}
