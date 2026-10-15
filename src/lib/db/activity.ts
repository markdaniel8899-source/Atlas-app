import { supabase } from "../supabase";
import type { HeatmapDay } from "./types";

export async function fetchHeatmap(days = 365): Promise<HeatmapDay[]> {
  const { data, error } = await supabase.rpc("activity_heatmap", {
    p_days: days,
  });

  if (error || !Array.isArray(data)) return [];
  return data as HeatmapDay[];
}

export function summariseHeatmap(days: HeatmapDay[]): {
  totalSeconds: number;
  activeDays: number;
} {
  let totalSeconds = 0;
  let activeDays = 0;
  for (const day of days) {
    const seconds = Number(day.total_seconds) || 0;
    if (seconds > 0) activeDays += 1;
    totalSeconds += seconds;
  }
  return { totalSeconds, activeDays };
}
