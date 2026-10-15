import { supabase } from '@/lib/supabase';

import { notifyCoursesChanged } from './events';
import type { Course, CourseRef, CourseStatus, CourseTopic, FocusCourse, FocusTopic } from './types';

interface FocusRow {
  id: number;
  title: string;
  accent: string;
  progress_percentage: number;
  status: CourseStatus;
  course_topics: FocusTopic[];
}

interface TopicRow {
  id: number;
  title: string;
  summary: string | null;
  position: number;
  status: CourseStatus;
  progress_percentage: number;
  completed_at: string | null;
}

interface CourseRow {
  id: number;
  title: string;
  description: string | null;
  accent: string | null;
  status: CourseStatus;
  progress_percentage: number | string;
  position: number;
  total_focus_seconds: number | null;
  course_topics: TopicRow[] | null;
}

const FOCUS_SELECT =
  'id, title, accent, progress_percentage, status, ' +
  'course_topics(id, title, position, status)';

const COURSE_SELECT =
  'id, title, description, accent, status, progress_percentage, position, ' +
  'total_focus_seconds, ' +
  'course_topics(id, title, summary, position, status, progress_percentage, completed_at)';

const ACCENTS = [
  '#9db4ff',
  '#5fbdb2',
  '#a982e0',
  '#5aa7cd',
  '#e0975f',
  '#cd6f95',
  '#cf9eff',
];

function pickActive(rows: FocusRow[]): FocusRow | null {
  return (
    rows.find((row) => row.status === 'in_progress') ??
    rows.find((row) => row.status === 'paused') ??
    rows.find((row) => row.status === 'not_started') ??
    null
  );
}

function normaliseTopic(row: TopicRow): CourseTopic {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? '',
    position: row.position,
    status: row.status,
    progress_percentage: Number(row.progress_percentage) || 0,
    completed_at: row.completed_at,
  };
}

function normaliseCourse(row: CourseRow): Course {
  const topics = [...(row.course_topics ?? [])]
    .map(normaliseTopic)
    .sort((a, b) => a.position - b.position);

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    accent: row.accent ?? '#cf9eff',
    status: row.status,
    progress_percentage: Number(row.progress_percentage) || 0,
    position: row.position,
    total_focus_seconds: Number(row.total_focus_seconds) || 0,
    topics,
  };
}

export async function fetchCourses(userId: string | null): Promise<Course[]> {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'course_topics', ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as unknown as CourseRow[]).map(normaliseCourse);
}

export async function fetchFocusCourse(userId: string | null): Promise<FocusCourse | null> {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('courses')
    .select(FOCUS_SELECT)
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'course_topics', ascending: true });

  if (error || !Array.isArray(data)) return null;

  const active = pickActive(data as unknown as FocusRow[]);
  if (!active) return null;

  return {
    id: active.id,
    title: active.title,
    accent: active.accent,
    progress_percentage: Number(active.progress_percentage) || 0,
    status: active.status,
    topics: [...(active.course_topics ?? [])],
  };
}

export async function fetchCourseRef(userId: string | null, courseId: number): Promise<CourseRef | null> {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, accent')
    .eq('id', courseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { id: number; title: string; accent: string | null };
  return { id: row.id, title: row.title, accent: row.accent ?? '#cf9eff' };
}

export async function findCourseByTitle(
  userId: string | null,
  title: string,
): Promise<CourseRef | null> {
  if (!supabase || !userId) return null;
  const needle = title.trim().toLowerCase();
  if (!needle) return null;

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, accent')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error || !Array.isArray(data)) return null;
  const rows = data as { id: number; title: string; accent: string | null }[];
  const match = rows.find((row) => row.title.trim().toLowerCase() === needle);
  if (!match) return null;
  return { id: match.id, title: match.title, accent: match.accent ?? '#cf9eff' };
}

export function nextTopic(course: FocusCourse | null): FocusTopic | null {
  if (!course) return null;
  return (
    course.topics.find((topic) => topic.status !== 'completed') ??
    course.topics[0] ??
    null
  );
}

export function topicCounts(course: FocusCourse): { total: number; done: number } {
  const total = course.topics.length;
  const done = course.topics.filter((topic) => topic.status === 'completed').length;
  return { total, done };
}

async function nextPosition(
  table: 'courses' | 'course_topics',
  filter: { course_id?: number; user_id?: string },
): Promise<number> {
  if (!supabase) return 0;
  let query = supabase.from(table).select('position');

  if (filter.course_id !== undefined) {
    query = query.eq('course_id', filter.course_id);
  }
  if (filter.user_id !== undefined) {
    query = query.eq('user_id', filter.user_id);
  }

  const { data } = await query
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 0;
  const value = (data as Record<string, unknown>).position;
  return typeof value === 'number' ? value + 1 : 1;
}

export async function createCourse(
  userId: string | null,
  title: string,
  description = '',
): Promise<Course | null> {
  if (!supabase || !userId) return null;

  const trimmed = title.trim();
  if (!trimmed) return null;

  const position = await nextPosition('courses', { user_id: userId });
  const accent = ACCENTS[position % ACCENTS.length];

  const { data, error } = await supabase
    .from('courses')
    .insert({
      user_id: userId,
      title: trimmed,
      description: description.trim(),
      accent,
      position,
      status: 'not_started',
    })
    .select(COURSE_SELECT)
    .maybeSingle();

  if (error || !data) return null;
  const course = normaliseCourse(data as unknown as CourseRow);
  notifyCoursesChanged();
  return course;
}

export async function createTopic(
  userId: string | null,
  courseId: number,
  title: string,
): Promise<CourseTopic | null> {
  if (!supabase || !userId) return null;

  const trimmed = title.trim();
  if (!trimmed) return null;

  const position = await nextPosition('course_topics', { course_id: courseId });

  const { data, error } = await supabase
    .from('course_topics')
    .insert({
      user_id: userId,
      course_id: courseId,
      title: trimmed,
      position,
      status: 'not_started',
    })
    .select('id, title, summary, position, status, progress_percentage, completed_at')
    .maybeSingle();

  if (error || !data) return null;
  notifyCoursesChanged();
  return normaliseTopic(data as unknown as TopicRow);
}

async function recomputeCourseProgress(courseId: number): Promise<void> {
  if (!supabase) return;
  const { data: topicRows } = await supabase
    .from('course_topics')
    .select('status')
    .eq('course_id', courseId);

  const rows = (topicRows ?? []) as { status: CourseStatus }[];
  const total = rows.length;
  const done = rows.filter((row) => row.status === 'completed').length;
  const progress = total > 0 ? Math.round((done / total) * 10000) / 100 : 0;

  const { data: courseRow } = await supabase
    .from('courses')
    .select('status')
    .eq('id', courseId)
    .maybeSingle();

  const current = (courseRow?.status as CourseStatus | undefined) ?? 'not_started';
  const status: CourseStatus =
    total > 0 && done === total
      ? 'completed'
      : done > 0
        ? 'in_progress'
        : current;

  await supabase
    .from('courses')
    .update({ progress_percentage: progress, status })
    .eq('id', courseId);
}

export async function setTopicStatus(
  courseId: number,
  topicId: number,
  status: CourseStatus,
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('course_topics')
    .update({
      status,
      progress_percentage: status === 'completed' ? 100 : 0,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', topicId);

  await recomputeCourseProgress(courseId);
  notifyCoursesChanged();
}

export async function removeTopic(
  courseId: number,
  topicId: number,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('course_topics')
    .delete()
    .eq('id', topicId)
    .eq('course_id', courseId);

  if (error) return false;

  await recomputeCourseProgress(courseId);
  notifyCoursesChanged();
  return true;
}

export async function deleteCourse(
  userId: string | null,
  courseId: number,
): Promise<boolean> {
  if (!supabase || !userId) return false;

  const { data: topicRows } = await supabase
    .from('course_topics')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId);
  const topicIds = (topicRows ?? [])
    .map((row) => (row as { id: number }).id)
    .filter((id) => Number.isSafeInteger(id));

  let notesQuery = supabase
    .from('notes')
    .delete()
    .eq('user_id', userId);
  notesQuery =
    topicIds.length > 0
      ? notesQuery.or(
          `course_id.eq.${courseId},topic_id.in.(${topicIds.join(',')})`,
        )
      : notesQuery.eq('course_id', courseId);
  const { error: notesError } = await notesQuery;
  if (notesError) return false;

  const { error: roadmapError } = await supabase
    .from('roadmaps')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId);
  if (roadmapError) return false;

  const { error: sessionError } = await supabase
    .from('learning_sessions')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId);
  if (sessionError) return false;

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', userId);
  if (error) return false;

  notifyCoursesChanged();
  return true;
}

export async function getFocusSeconds(userId: string | null, courseId: number | null): Promise<number> {
  if (!supabase || !userId || courseId == null) return 0;

  const { data, error } = await supabase
    .from('courses')
    .select('total_focus_seconds')
    .eq('id', courseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return 0;
  return Math.max(0, Number((data as { total_focus_seconds?: unknown }).total_focus_seconds) || 0);
}

export async function addFocusSeconds(
  userId: string | null,
  courseId: number,
  seconds: number,
): Promise<boolean> {
  if (!supabase || !userId) return false;
  if (!Number.isFinite(seconds) || seconds < 1) return false;

  const current = await getFocusSeconds(userId, courseId);
  const { error } = await supabase
    .from('courses')
    .update({ total_focus_seconds: current + Math.floor(seconds) })
    .eq('id', courseId)
    .eq('user_id', userId);

  return !error;
}
