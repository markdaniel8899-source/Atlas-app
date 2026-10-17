import { Platform } from "react-native";
import { getRankFromXP } from "../gamification";
import type { Profile } from "../db/types";
import {
  FALLBACK_WIDGET_DATA,
  saveAtlasWidgetData,
} from "./atlas-widget-data";
import type { AtlasWidgetData } from "./atlas-widget-data";

function buildWidgetData(profile: Profile): AtlasWidgetData {
  const xp = Math.max(0, Math.floor(profile.xp ?? 0));
  return {
    streak: Math.max(0, Math.floor(profile.streak ?? 0)),
    level: Math.max(1, Math.floor(profile.level ?? 1)),
    xp,
    rankName: getRankFromXP(xp).name,
  };
}

/**
 * Mirrors the latest profile snapshot into the home-screen widget cache.
 * Pass null when signed out so the widget never leaks one account's stats
 * to the next viewer. No-ops on binaries without the widget module.
 */
export function syncAtlasWidget(profile: Profile | null): void {
  const data = profile ? buildWidgetData(profile) : FALLBACK_WIDGET_DATA;
  void saveAtlasWidgetData(data);
  if (Platform.OS !== "android") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
    const updater = require("./widget-update") as typeof import("./widget-update");
    updater.pushAtlasWidgetUpdate(data);
  } catch {
    // Widget native module missing (older APK) - skip silently.
  }
}
