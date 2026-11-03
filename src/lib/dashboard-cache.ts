import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FocusCourse, HeatmapDay } from "./db/types";

/**
 * Persistent per-owner dashboard snapshot (heatmap + focus course). Lets the
 * dashboard paint last-session rank/streak/XP/heatmap on a cold offline start
 * instead of an empty screen, then revalidates against the server when the
 * network returns.
 *
 * Key: atlas.dashboard.home.v1:<ownerId>
 */

const PREFIX = "atlas.dashboard.home.v1";

function key(ownerId: string): string {
  return `${PREFIX}:${ownerId}`;
}

export interface DashboardSnapshot {
  heatmap: HeatmapDay[];
  focus: FocusCourse | null;
}

export async function readDashboardCache(
  ownerId: string,
): Promise<DashboardSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(key(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const s = parsed as DashboardSnapshot;
    if (!Array.isArray(s.heatmap)) return null;
    return s;
  } catch {
    return null;
  }
}

export async function writeDashboardCache(
  ownerId: string,
  snapshot: DashboardSnapshot,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(ownerId), JSON.stringify(snapshot));
  } catch {
    // Best-effort cache only.
  }
}

export async function clearDashboardCache(ownerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(ownerId));
  } catch {
    // Best-effort.
  }
}
