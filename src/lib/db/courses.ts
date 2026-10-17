import { resolveSession } from "../auth";
import {
  notifyCoursesChanged,
  notifyRoadmapsChanged,
} from "../events";
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

const ACCENTS = [
  "#9db4ff",
  "#5fbdb2",
  "#a982e0",
  "#5aa7cd",
  "#e0975f",
  "#cd6f95",
  "#cf9eff",
];

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

/* ---------------------------------------------------------------
   COURSE MANAGEMENT (settings page)
--------------------------------------------------------------- */

async function nextPosition(
  table: "courses" | "course_topics",
  filter: { course_id?: number; user_id?: string },
): Promise<number> {
  let query = supabase.from(table).select("position");

  if (filter.course_id !== undefined) {
    query = query.eq("course_id", filter.course_id);
  }
  if (filter.user_id !== undefined) {
    query = query.eq("user_id", filter.user_id);
  }

  const { data } = await query
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 0;
  const value = (data as Record<string, unknown>).position;
  return typeof value === "number" ? value + 1 : 1;
}

/** Rename a course and/or change its source description. */
export async function updateCourse(
  courseId: number,
  changes: { title?: string; description?: string },
): Promise<Course | null> {
  const user = await resolveSession();
  if (!user) return null;

  const patch: { title?: string; description?: string } = {};

  if (changes.title !== undefined) {
    const trimmed = changes.title.trim();
    if (!trimmed) return null;
    patch.title = trimmed;
  }
  if (changes.description !== undefined) {
    patch.description = changes.description.trim();
  }
  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", courseId)
    .eq("user_id", user.id)
    .select(COURSE_SELECT)
    .maybeSingle();

  if (error || !data) return null;
  const course = normaliseCourse(data as unknown as CourseRow);
  notifyCoursesChanged();
  return course;
}

/**
 * Delete a course together with everything that belongs to it: its roadmap
 * (nodes and connections cascade from the roadmap row), its study sessions
 * (the FK would only null them out), its notes (directly linked via
 * notes.course_id and via the course's topics), topics, quizzes and quiz
 * attempts. Every step is checked - if a step fails the course row is left
 * untouched, so a failed delete never orphans a roadmap.
 */
export async function deleteCourse(courseId: number): Promise<boolean> {
  const user = await resolveSession();
  if (!user) return false;

  // Notes first: they hang off the topics that the course delete cascades.
  const { data: topicRows } = await supabase
    .from("course_topics")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  const topicIds = (topicRows ?? [])
    .map((row) => (row as { id: number }).id)
    .filter((id) => Number.isSafeInteger(id));

  let notesQuery = supabase.from("notes").delete().eq("user_id", user.id);
  notesQuery =
    topicIds.length > 0
      ? notesQuery.or(
          `course_id.eq.${courseId},topic_id.in.(${topicIds.join(",")})`,
        )
      : notesQuery.eq("course_id", courseId);
  const { error: notesError } = await notesQuery;
  if (notesError) return false;

  const { error: roadmapError } = await supabase
    .from("roadmaps")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  if (roadmapError) return false;

  const { error: sessionError } = await supabase
    .from("learning_sessions")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  if (sessionError) return false;

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", user.id);
  if (error) return false;

  notifyRoadmapsChanged();
  notifyCoursesChanged();
  return true;
}

/** Append a topic to a course (alias of createTopic). */
export async function addTopic(
  courseId: number,
  title: string,
): Promise<CourseTopic | null> {
  return createTopic(courseId, title);
}

export async function createTopic(
  courseId: number,
  title: string,
): Promise<CourseTopic | null> {
  const user = await resolveSession();
  if (!user) return null;

  const trimmed = title.trim();
  if (!trimmed) return null;

  const position = await nextPosition("course_topics", {
    course_id: courseId,
  });

  const { data, error } = await supabase
    .from("course_topics")
    .insert({
      user_id: user.id,
      course_id: courseId,
      title: trimmed,
      position,
      status: "not_started",
    })
    .select(
      "id, title, summary, position, status, progress_percentage, completed_at",
    )
    .maybeSingle();

  if (error || !data) return null;
  notifyCoursesChanged();
  return normaliseTopic(data as unknown as TopicRow);
}

export interface CourseRef {
  id: number;
  title: string;
}

/** Create a course row (status not_started) and notify listeners. */
export async function createCourse(
  title: string,
  description = "",
): Promise<Course | null> {
  const user = await resolveSession();
  if (!user) return null;

  const trimmed = title.trim();
  if (!trimmed) return null;

  const position = await nextPosition("courses", { user_id: user.id });
  const accent = ACCENTS[position % ACCENTS.length];

  const { data, error } = await supabase
    .from("courses")
    .insert({
      user_id: user.id,
      title: trimmed,
      description: description.trim(),
      accent,
      position,
      status: "not_started",
    })
    .select(COURSE_SELECT)
    .maybeSingle();

  if (error || !data) return null;
  const course = normaliseCourse(data as unknown as CourseRow);
  notifyCoursesChanged();
  return course;
}

/**
 * Find-only lookup: a course whose title matches `title` (case-insensitive),
 * or null. Used to reuse a course before deciding what title to create.
 */
export async function findCourseByTitle(
  title: string,
): Promise<CourseRef | null> {
  const user = await resolveSession();
  if (!user) return null;

  const clean = title.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!clean) return null;

  const { data } = await supabase
    .from("courses")
    .select("id, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!data || !Array.isArray(data)) return null;

  const target = clean.toLowerCase();
  const match = (data as unknown as CourseRef[]).find(
    (row) => row.title.replace(/\s+/g, " ").trim().toLowerCase() === target,
  );
  return match ? { id: match.id, title: match.title } : null;
}

/**
 * Find a course whose title matches `title` (case-insensitive), or create one
 * (status 'not_started', progress 0). Used so every generated roadmap is
 * linked to a course without duplicating rows.
 */
export async function findOrCreateCourseByTitle(
  title: string,
): Promise<CourseRef | null> {
  const user = await resolveSession();
  if (!user) return null;

  const clean = title.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!clean) return null;

  const existing = await findCourseByTitle(clean);
  if (existing) return existing;

  const created = await createCourse(clean, "");
  return created ? { id: created.id, title: created.title } : null;
}

/**
 * Bulk status write used by roadmap → course sync, then one progress
 * recompute for the course.
 */
export async function syncTopicStatuses(
  courseId: number,
  updates: { id: number; status: CourseStatus }[],
): Promise<boolean> {
  if (updates.length === 0) return true;

  const user = await resolveSession();
  if (!user) return false;

  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from("course_topics")
        .update({
          status: update.status,
          progress_percentage: update.status === "completed" ? 100 : 0,
          completed_at:
            update.status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", update.id)
        .eq("user_id", user.id),
    ),
  );

  if (!results.every((result) => !result.error)) return false;

  await recomputeCourseProgress(courseId);
  notifyCoursesChanged();
  return true;
}

export async function setTopicStatus(
  courseId: number,
  topicId: number,
  status: CourseStatus,
): Promise<void> {
  const user = await resolveSession();
  if (!user) return;

  await supabase
    .from("course_topics")
    .update({
      status,
      progress_percentage: status === "completed" ? 100 : 0,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", topicId)
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  await recomputeCourseProgress(courseId);
  notifyCoursesChanged();
}

/** Remove one topic and recompute the course progress. */
export async function removeTopic(
  courseId: number,
  topicId: number,
): Promise<boolean> {
  const user = await resolveSession();
  if (!user) return false;

  const { error } = await supabase
    .from("course_topics")
    .delete()
    .eq("id", topicId)
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  if (error) return false;

  await recomputeCourseProgress(courseId);
  notifyCoursesChanged();
  return true;
}

async function recomputeCourseProgress(courseId: number): Promise<void> {
  const user = await resolveSession();
  if (!user) return;

  const { data: topicRows } = await supabase
    .from("course_topics")
    .select("status")
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  const rows = (topicRows ?? []) as { status: CourseStatus }[];
  const total = rows.length;
  const done = rows.filter((row) => row.status === "completed").length;
  const progress = total > 0 ? Math.round((done / total) * 10000) / 100 : 0;

  const { data: courseRow } = await supabase
    .from("courses")
    .select("status")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  const current =
    ((courseRow as { status?: CourseStatus } | null)?.status) ?? "not_started";
  const status: CourseStatus =
    total > 0 && done === total
      ? "completed"
      : done > 0
        ? "in_progress"
        : current;

  await supabase
    .from("courses")
    .update({ progress_percentage: progress, status })
    .eq("id", courseId)
    .eq("user_id", user.id);
}
