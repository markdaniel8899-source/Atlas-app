import { resolveSession } from "../auth";
import { supabase } from "../supabase";
import type {
  Course,
  CourseStatus,
  CourseTopic,
  FocusCourse,
  FocusTopic,
} from "./types";

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
  "id, title, accent, progress_percentage, status, " +
  "course_topics(id, title, position, status)";

const COURSE_SELECT =
  "id, title, description, accent, status, progress_percentage, position, " +
  "total_focus_seconds, " +
  "course_topics(id, title, summary, position, status, progress_percentage, completed_at)";

function pickActive(rows: FocusRow[]): FocusRow | null {
  return (
    rows.find((row) => row.status === "in_progress") ??
    rows.find((row) => row.status === "paused") ??
    rows.find((row) => row.status === "not_started") ??
    null
  );
}

function normaliseTopic(row: TopicRow): CourseTopic {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? "",
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
    description: row.description ?? "",
    accent: row.accent ?? "#cf9eff",
    status: row.status,
    progress_percentage: Number(row.progress_percentage) || 0,
    position: row.position,
    total_focus_seconds: Number(row.total_focus_seconds) || 0,
    topics,
  };
}

export async function fetchCourses(): Promise<Course[]> {
  const user = await resolveSession();
  if (!user) return [];

  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("position", {
      referencedTable: "course_topics",
      ascending: true,
    });

  if (error || !Array.isArray(data)) return [];

  return (data as unknown as CourseRow[]).map(normaliseCourse);
}

export async function fetchFocusCourse(): Promise<FocusCourse | null> {
  const user = await resolveSession();
  if (!user) return null;

  const { data, error } = await supabase
    .from("courses")
    .select(FOCUS_SELECT)
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("position", {
      referencedTable: "course_topics",
      ascending: true,
    });

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

export function nextTopic(course: FocusCourse | null): FocusTopic | null {
  if (!course) return null;
  return (
    course.topics.find((topic) => topic.status !== "completed") ??
    course.topics[0] ??
    null
  );
}

export function topicCounts(course: FocusCourse): {
  total: number;
  done: number;
} {
  const total = course.topics.length;
  const done = course.topics.filter((topic) => topic.status === "completed")
    .length;
  return { total, done };
}

/**
 * Cumulative focus counter: lifetime focused seconds for a course.
 * Returns 0 when there is no course, no row, or the column is missing.
 */
export async function getFocusSeconds(
  courseId: number | null,
): Promise<number> {
  if (courseId == null) return 0;
  const user = await resolveSession();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("courses")
    .select("total_focus_seconds")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return 0;
  const value = Number(
    (data as { total_focus_seconds?: unknown }).total_focus_seconds,
  );
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Add a delta to the course's cumulative focus time. Writes are serialized
 * by the caller (see db/focus.ts) so rapid pause/resume cycles can't lose
 * an update.
 */
export async function addFocusSeconds(
  courseId: number,
  seconds: number,
): Promise<boolean> {
  if (!Number.isFinite(seconds) || seconds < 1) return false;
  const user = await resolveSession();
  if (!user) return false;

  const current = await getFocusSeconds(courseId);
  const { error } = await supabase
    .from("courses")
    .update({ total_focus_seconds: current + Math.floor(seconds) })
    .eq("id", courseId)
    .eq("user_id", user.id);

  return !error;
}
