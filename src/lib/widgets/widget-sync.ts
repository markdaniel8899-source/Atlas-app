import { Platform } from "react-native";
import type { HeatmapDay, Profile } from "../db/types";
import type { Note } from "../notes";
import {
  FALLBACK_WIDGET_DATA,
  saveAtlasWidgetData,
} from "./atlas-widget-data";
import {
  EMPTY_NOTES_WIDGET_DATA,
  saveNotesWidgetData,
} from "./notes-widget-data";
import { buildNotesWidgetData, buildStatsData } from "./widget-model";
import { diag } from "../diagnostics";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  let data = FALLBACK_WIDGET_DATA;
  if (profile) {
    try {
      data = buildStatsData(profile, heatmap);
    } catch (error) {
      diag("widget:stats:build-fail", { message: describe(error) });
    }
  }
  void saveAtlasWidgetData(data);
  if (Platform.OS !== "android") return;
  try {
    diag("widget:stats:push");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
    const updater = require("./widget-update") as typeof import("./widget-update");
    updater.pushAtlasStatsWidgetUpdate(data);
  } catch (error) {
    diag("widget:stats:require-fail", { message: describe(error) });
  }
}

/**
 * Mirrors the newest notes into the quick-notes widget cache.
 * Pass null on sign-out so the widget falls back to its empty state.
 */
export function syncAtlasNotesWidget(notes: Note[] | null): void {
  let data = EMPTY_NOTES_WIDGET_DATA;
  if (notes !== null) {
    try {
      data = buildNotesWidgetData(notes);
    } catch (error) {
      diag("widget:notes:build-fail", { message: describe(error) });
    }
  }
  void saveNotesWidgetData(data);
  if (Platform.OS !== "android") return;
  try {
    diag("widget:notes:push");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
    const updater = require("./widget-update") as typeof import("./widget-update");
    updater.pushNotesWidgetUpdate(data);
  } catch (error) {
    diag("widget:notes:require-fail", { message: describe(error) });
  }
}
