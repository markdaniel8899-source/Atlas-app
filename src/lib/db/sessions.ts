import { supabase } from '@/lib/supabase';

import { notifyProfileChanged } from './events';

export interface SessionLog {
  startedAt: Date;
  endedAt: Date;
  label?: string;
  courseId?: number | null;
  topicId?: number | null;
}

export interface RecentSession {
  id: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  label: string;
  courseTitle: string | null;
}

export const XP_PER_MINUTE = 1;

export function sessionXp(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60) * XP_PER_MINUTE);
}

export async function logSession(entry: SessionLog): Promise<boolean> {
  if (!supabase) return false;

  const seconds = Math.max(
    0,
    Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000),
  );
  if (seconds < 60) return false;

  const { error } = await supabase.from('learning_sessions').insert({
    started_at: entry.startedAt.toISOString(),
    ended_at: entry.endedAt.toISOString(),
    total_seconds: seconds,
    label: entry.label ?? '',
    course_id: entry.courseId ?? null,
    topic_id: entry.topicId ?? null,
  });

  if (error) return false;

  const { error: xpError } = await supabase.rpc('record_activity', {
    p_xp: sessionXp(seconds),
  });
  if (!xpError) notifyProfileChanged();
  return true;
}

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string;
  total_seconds: number;
  label: string | null;
  courses: { title: string } | { title: string }[] | null;
}

function readCourseTitle(value: SessionRow['courses']): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.title ?? null;
  return value.title ?? null;
}

export async function fetchRecentSessions(
  userId: string | null,
  limit = 10,
): Promise<RecentSession[]> {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('learning_sessions')
    .select('id, started_at, ended_at, total_seconds, label, courses(title)')
    .eq('user_id', userId)
    .order('ended_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];

  return (data as unknown as SessionRow[]).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: Math.max(1, Math.round((Number(row.total_seconds) || 0) / 60)),
    label: row.label ?? '',
    courseTitle: readCourseTitle(row.courses),
  }));
}
