import { resolveSession } from "../auth";
import { sanitizeHtml } from "../notes";
import type { Note } from "../notes";
import { supabase } from "../supabase";

interface NoteRow {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  course_id: number | null;
  topic_id: number | null;
  shared_by: string | null;
  shared_at: string | null;
}

const NOTE_COLUMNS =
  "id, title, content, updated_at, course_id, topic_id, shared_by, shared_at";

function toNote(row: NoteRow): Note {
  return {
    id: String(row.id),
    title: row.title,
    html: sanitizeHtml(row.content),
    updatedAt: Number.isNaN(Date.parse(row.updated_at))
      ? Date.now()
      : Date.parse(row.updated_at),
    courseId: typeof row.course_id === "number" ? row.course_id : null,
    topicId: typeof row.topic_id === "number" ? row.topic_id : null,
    courseTitle: null,
    sharedBy: row.shared_by ?? null,
    sharedAt: row.shared_at ? Date.parse(row.shared_at) : null,
  };
}

function toId(id: string): number | null {
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * `notes.title` is CHECK (1..160). The UI lets an empty title mean
 * "Untitled note", so every write is clamped here - otherwise a cleared
 * title would fail forever and block the offline queue.
 */
const TITLE_MAX = 160;

function clampTitle(value: string): string {
  const sliced = value.slice(0, TITLE_MAX);
  return sliced.trim().length > 0 ? sliced : "Untitled note";
}

/**
 * Map each note id to its owning course's title - directly via
 * notes.course_id, or through notes.topic_id -> course_topics.course_id.
 * Two extra queries only when the fetched notes are actually linked.
 */
async function loadCourseTitles(rows: NoteRow[]): Promise<Map<number, string>> {
  const byNote = new Map<number, string>();
  const courseIds = new Set<number>(
    rows
      .map((row) => row.course_id)
      .filter((id): id is number => typeof id === "number"),
  );
  const topicIds = [
    ...new Set(
      rows
        .map((row) => row.topic_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];

  const topicCourse = new Map<number, number>();
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("course_topics")
      .select("id, course_id")
      .in("id", topicIds);
    if (Array.isArray(topics)) {
      for (const row of topics as { id: number; course_id: number | null }[]) {
        if (row.course_id == null) continue;
        topicCourse.set(row.id, row.course_id);
        courseIds.add(row.course_id);
      }
    }
  }
  if (courseIds.size === 0) return byNote;

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", [...courseIds]);
  if (!Array.isArray(courses)) return byNote;

  const titleByCourse = new Map<number, string>();
  for (const row of courses as { id: number; title: string }[]) {
    titleByCourse.set(row.id, row.title);
  }
  for (const row of rows) {
    const courseId =
      row.course_id ??
      (row.topic_id != null ? topicCourse.get(row.topic_id) : undefined);
    if (courseId == null) continue;
    const title = titleByCourse.get(courseId);
    if (title) byNote.set(row.id, title);
  }
  return byNote;
}

export interface NotesScope {
  /** Only notes of this course (notes.course_id) - the "course selected" view. */
  courseId?: number;
  /**
   * Only notes attached to these course topics. Without `courseId` this is
   * an exact topic filter; an empty array means no topics, so no notes.
   */
  topicIds?: number[];
}

export async function fetchNotes(scope?: NotesScope): Promise<Note[]> {
  const user = await resolveSession();
  if (!user) return [];

  if (
    scope?.courseId == null &&
    scope?.topicIds &&
    scope.topicIds.length === 0
  ) {
    return [];
  }

  let query = supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (scope?.courseId != null) {
    if (scope.topicIds && scope.topicIds.length > 0) {
      // Course view: everything linked to the course directly OR through a
      // topic (covers rows written before course_id existed).
      query = query.or(
        `course_id.eq.${scope.courseId},topic_id.in.(${scope.topicIds.join(",")})`,
      );
    } else {
      query = query.eq("course_id", scope.courseId);
    }
  } else if (scope?.topicIds) {
    query = query.in("topic_id", scope.topicIds);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  const rows = data as unknown as NoteRow[];
  const courseByNote = await loadCourseTitles(rows);
  return rows.map((row) => {
    const note = toNote(row);
    note.courseTitle = courseByNote.get(row.id) ?? null;
    return note;
  });
}

/**
 * Insert a note with full content. Used both by "New note" and by the
 * offline queue when flushing locally-created notes.
 */
export interface NoteWriteResult {
  ok: boolean;
  /** A constraint/permission error - retrying forever cannot fix it. */
  permanent: boolean;
}

export interface NoteInsertResult {
  note: Note | null;
  permanent: boolean;
}

const PERMANENT_WRITE_ERROR_RE =
  /violates .*constraint|check constraint|not-null constraint|invalid input syntax|permission denied|row-level security|value too long|out of range/i;

function isPermanentWriteError(message: string | undefined): boolean {
  return typeof message === "string" && PERMANENT_WRITE_ERROR_RE.test(message);
}

export async function insertNote(input: {
  title: string;
  html: string;
  courseId: number | null;
  topicId: number | null;
}): Promise<NoteInsertResult> {
  const user = await resolveSession();
  if (!user) return { note: null, permanent: false };

  const payload: Record<string, unknown> = {
    user_id: user.id,
    title: clampTitle(input.title),
    content: sanitizeHtml(input.html),
  };
  if (typeof input.courseId === "number") {
    payload.course_id = input.courseId;
  }
  if (typeof input.topicId === "number") {
    payload.topic_id = input.topicId;
  }

  const { data, error } = await supabase
    .from("notes")
    .insert(payload)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return { note: null, permanent: isPermanentWriteError(error?.message) };
  }
  const note = toNote(data as unknown as NoteRow);
  note.courseId = typeof input.courseId === "number" ? input.courseId : null;
  note.topicId = typeof input.topicId === "number" ? input.topicId : null;
  return { note, permanent: false };
}

export async function createNote(options?: {
  courseId?: number | null;
  topicId?: number | null;
}): Promise<Note | null> {
  const { note } = await insertNote({
    title: "Untitled note",
    html: "",
    courseId: options?.courseId ?? null,
    topicId: options?.topicId ?? null,
  });
  return note;
}

/** `ok: false` means retry later unless `permanent`. */
export async function updateNote(
  id: string,
  patch: Partial<Omit<Note, "id">>,
): Promise<NoteWriteResult> {
  const parsed = toId(id);
  if (parsed === null) return { ok: false, permanent: true };

  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = clampTitle(patch.title);
  if (patch.html !== undefined) values.content = sanitizeHtml(patch.html);
  if (Object.keys(values).length === 0) return { ok: true, permanent: false };

  const user = await resolveSession();
  if (!user) return { ok: false, permanent: false };

  const { error } = await supabase
    .from("notes")
    .update(values)
    .eq("id", parsed)
    .eq("user_id", user.id);
  return {
    ok: !error,
    permanent: Boolean(error) && isPermanentWriteError(error?.message),
  };
}

/** `ok: false` means retry later unless `permanent`. */
export async function deleteNote(id: string): Promise<NoteWriteResult> {
  const parsed = toId(id);
  if (parsed === null) return { ok: false, permanent: true };

  const user = await resolveSession();
  if (!user) return { ok: false, permanent: false };

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsed)
    .eq("user_id", user.id);
  return {
    ok: !error,
    permanent: Boolean(error) && isPermanentWriteError(error?.message),
  };
}
