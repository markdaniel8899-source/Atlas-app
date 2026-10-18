import AsyncStorage from "@react-native-async-storage/async-storage";

/** Registered widget names - must match app.json (config plugin). */
export const ATLAS_STICKY_WIDGET_NAME = "AtlasStickyWidget";
export const ATLAS_NOTES_WIDGET_NAME = "AtlasNotesWidget";

export interface WidgetNote {
  id: string;
  title: string;
  snippet: string;
  timeLabel: string;
}

export interface NotesWidgetData {
  notes: WidgetNote[];
}

export const EMPTY_NOTES_WIDGET_DATA: NotesWidgetData = { notes: [] };

const CACHE_KEY = "atlas.widget.notes.v1";
const STICKY_INDEX_KEY = "atlas.widget.notes.sticky-index.v1";

let memory: NotesWidgetData | null = null;

/** Last notes snapshot for the sticky + quick-notes widgets. */
export async function loadNotesWidgetData(): Promise<NotesWidgetData> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotesWidgetData>;
      memory = {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      };
    }
  } catch {
    // Falls back to the empty state.
  }
  return memory ?? EMPTY_NOTES_WIDGET_DATA;
}

export async function saveNotesWidgetData(
  data: NotesWidgetData,
): Promise<void> {
  memory = data;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Best-effort cache only.
  }
}

/** Position inside the notes list shown by the sticky widget ("Next"). */
export async function loadStickyNoteIndex(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STICKY_INDEX_KEY);
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveStickyNoteIndex(index: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STICKY_INDEX_KEY,
      String(Math.max(0, Math.floor(index))),
    );
  } catch {
    // Best-effort - the widget simply repeats the previous note.
  }
}
