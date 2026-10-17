import AsyncStorage from "@react-native-async-storage/async-storage";

/** Registered widget name - must match app.json (config plugin). */
export const ATLAS_WIDGET_NAME = "AtlasWidget";

export interface AtlasWidgetData {
  streak: number;
  level: number;
  xp: number;
  rankName: string;
}

export const FALLBACK_WIDGET_DATA: AtlasWidgetData = {
  streak: 0,
  level: 1,
  xp: 0,
  rankName: "Bronze I",
};

const CACHE_KEY = "atlas.widget.data.v1";

let memory: AtlasWidgetData | null = null;

/** Last profile snapshot for the home-screen widget (cache-first). */
export async function loadAtlasWidgetData(): Promise<AtlasWidgetData> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) memory = JSON.parse(raw) as AtlasWidgetData;
  } catch {
    // Falls back to the placeholder card.
  }
  return memory ?? FALLBACK_WIDGET_DATA;
}

export async function saveAtlasWidgetData(data: AtlasWidgetData): Promise<void> {
  memory = data;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Best-effort cache only.
  }
}
