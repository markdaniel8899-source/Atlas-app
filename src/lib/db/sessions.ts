import { notifyProfileChanged } from "../events";
import { supabase } from "../supabase";

export interface SessionLog {
  startedAt: Date;
  endedAt: Date;
  label?: string;
  courseId?: number | null;
  topicId?: number | null;
}

export const XP_PER_MINUTE = 1;

export function sessionXp(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60) * XP_PER_MINUTE);
}

/**
 * Log a finished focus session into learning_sessions (heatmap + history)
 * and award XP through the record_activity RPC.
 */
export async function logSession(entry: SessionLog): Promise<boolean> {
  const seconds = Math.max(
    0,
    Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000),
  );
  if (seconds < 60) return false;

  const { error } = await supabase.from("learning_sessions").insert({
    started_at: entry.startedAt.toISOString(),
    ended_at: entry.endedAt.toISOString(),
    total_seconds: seconds,
    label: entry.label ?? "",
    course_id: entry.courseId ?? null,
    topic_id: entry.topicId ?? null,
  });

  if (error) return false;

  const { error: xpError } = await supabase.rpc("record_activity", {
    p_xp: sessionXp(seconds),
  });
  if (!xpError) notifyProfileChanged();
  return true;
}
