import { resolveSession } from "../auth";
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

  const user = await resolveSession();
  if (!user) return false;

  const payload: Record<string, unknown> = {
    user_id: user.id,
    started_at: entry.startedAt.toISOString(),
    ended_at: entry.endedAt.toISOString(),
    total_seconds: seconds,
    label: entry.label ?? "",
    course_id: entry.courseId ?? null,
    topic_id: entry.topicId ?? null,
  };

  let { error } = await supabase.from("learning_sessions").insert(payload);
  if (error && MISSING_USER_ID_RE.test(error.message)) {
    // Older schemas have no user_id column and rely on RLS + auth.uid().
    delete payload.user_id;
    ({ error } = await supabase.from("learning_sessions").insert(payload));
  }

  if (error) return false;

  const { error: xpError } = await supabase.rpc("record_activity", {
    p_xp: sessionXp(seconds),
  });
  if (!xpError) notifyProfileChanged();
  return true;
}

const MISSING_USER_ID_RE =
  /could not find the .user_id. column|column .*user_id.* does not exist/i;
