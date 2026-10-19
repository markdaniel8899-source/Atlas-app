import { Platform } from "react-native";
import type { HeatmapDay, Profile } from "../db/types";
import type { Note } from "../notes";
import {
  FALLBACK_WIDGET_DATA,
  saveAtlasWidgetData,
} from "./atlas-widget-data";
import {
  EMPTY_NOTES_WIDGET_DATA,
  loadStickyNoteIndex,
  saveNotesWidgetData,
} from "./notes-widget-data";
import { buildNotesWidgetData, buildStatsData } from "./widget-model";

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

/**
 * Mirrors the newest notes into the sticky + quick-notes widget caches.
 * Pass null on sign-out so both widgets fall back to their empty states.
 */
export function syncAtlasNotesWidget(notes: Note[] | null): void {
  const data =
    notes === null ? EMPTY_NOTES_WIDGET_DATA : buildNotesWidgetData(notes);
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
