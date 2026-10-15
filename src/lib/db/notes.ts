import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

import type { Note } from './types';

interface NoteRow {
  id: number;
  title: string;
  content: string;
  updated_at: string;
  course_id: number | null;
  topic_id: number | null;
}

const NOTE_COLUMNS = 'id, title, content, updated_at, course_id, topic_id';

const CACHE_KEY = 'atlas.notes.cache';
const PENDING_KEY = 'atlas.notes.pending';
const IDMAP_KEY = 'atlas.notes.idmap';

// Non-network failures get a few retries (across flushes) before the op is
// dropped so one poison row can never wedge the whole queue forever.
const MAX_OP_ATTEMPTS = 3;

type PendingOp =
  | {
      kind: 'create';
      localId: string;
      userId: string;
      title: string;
      content: string;
      courseId: number | null;
      topicId: number | null;
      ts: number;
      attempts: number;
    }
  | {
      kind: 'update';
      id: string;
      title: string | null;
      content: string | null;
      ts: number;
      attempts: number;
    }
  | { kind: 'delete'; id: string; ts: number; attempts: number };

interface NotesStore {
  cache: Record<string, Note[]>;
  pending: PendingOp[];
  idmap: Record<string, number>;
}

let storePromise: Promise<NotesStore> | null = null;
let flushing = false;

function makeLocalId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isNumericId(id: string): boolean {
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

function toDisplayId(store: NotesStore, remoteId: number): string {
  for (const [localId, mapped] of Object.entries(store.idmap)) {
    if (mapped === remoteId) return localId;
  }
  return String(remoteId);
}

function toRemoteId(store: NotesStore, displayId: string): number | null {
  const mapped = store.idmap[displayId];
  if (typeof mapped === 'number') return mapped;
  return isNumericId(displayId) ? Number(displayId) : null;
}

function hasPendingCreate(store: NotesStore, id: string): boolean {
  return store.pending.some((op) => op.kind === 'create' && op.localId === id);
}

function loadStore(): Promise<NotesStore> {
  if (storePromise) return storePromise;

  storePromise = (async (): Promise<NotesStore> => {
    try {
      const [cacheRaw, pendingRaw, idmapRaw] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(PENDING_KEY),
        AsyncStorage.getItem(IDMAP_KEY),
      ]);

      const cache = cacheRaw ? (JSON.parse(cacheRaw) as Record<string, Note[]>) : {};
      const pending = pendingRaw ? (JSON.parse(pendingRaw) as PendingOp[]) : [];
      const idmap = idmapRaw ? (JSON.parse(idmapRaw) as Record<string, number>) : {};

      return {
        cache: cache && typeof cache === 'object' ? cache : {},
        pending: Array.isArray(pending) ? pending : [],
        idmap: idmap && typeof idmap === 'object' ? idmap : {},
      };
    } catch {
      return { cache: {}, pending: [], idmap: {} };
    }
  })();

  return storePromise;
}

async function persist(store: NotesStore): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(store.cache));
  } catch {
    // best-effort
  }
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(store.pending));
  } catch {
    // best-effort
  }
  try {
    await AsyncStorage.setItem(IDMAP_KEY, JSON.stringify(store.idmap));
  } catch {
    // best-effort
  }
}

function matchesScope(note: Note, scope?: NotesScope): boolean {
  if (!scope) return true;
  if (scope.courseId != null) {
    if (note.courseId === scope.courseId) return true;
    if (
      scope.topicIds &&
      scope.topicIds.length > 0 &&
      note.topicId != null &&
      scope.topicIds.includes(note.topicId)
    ) {
      return true;
    }
    return false;
  }
  if (scope.topicIds) {
    return note.topicId != null && scope.topicIds.includes(note.topicId);
  }
  return true;
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

function toNote(row: NoteRow): Note {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content ?? '',
    updatedAt: Number.isNaN(Date.parse(row.updated_at))
      ? Date.now()
      : Date.parse(row.updated_at),
    courseId: typeof row.course_id === 'number' ? row.course_id : null,
    topicId: typeof row.topic_id === 'number' ? row.topic_id : null,
    courseTitle: null,
  };
}

async function loadCourseTitles(rows: NoteRow[]): Promise<Map<number, string>> {
  if (!supabase) return new Map();
  const byNote = new Map<number, string>();
  const courseIds = new Set<number>(
    rows
      .map((row) => row.course_id)
      .filter((id): id is number => typeof id === 'number'),
  );
  const topicIds = [
    ...new Set(
      rows
        .map((row) => row.topic_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];

  const topicCourse = new Map<number, number>();
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('course_topics')
      .select('id, course_id')
      .in('id', topicIds);
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
    .from('courses')
    .select('id, title')
    .in('id', [...courseIds]);
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
  courseId?: number;
  topicIds?: number[];
}

async function fetchRemoteNotes(
  store: NotesStore,
  userId: string,
  scope?: NotesScope,
): Promise<Note[]> {
  if (!supabase) return [];

  let query = supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (scope?.courseId != null) {
    if (scope.topicIds && scope.topicIds.length > 0) {
      query = query.or(
        `course_id.eq.${scope.courseId},topic_id.in.(${scope.topicIds.join(',')})`,
      );
    } else {
      query = query.eq('course_id', scope.courseId);
    }
  } else if (scope?.topicIds) {
    query = query.in('topic_id', scope.topicIds);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    if (error) throw new Error(error.message);
    return [];
  }

  const rows = data as unknown as NoteRow[];
  const courseByNote = await loadCourseTitles(rows);
  return rows.map((row) => {
    const note = toNote(row);
    note.id = toDisplayId(store, row.id);
    note.courseTitle = courseByNote.get(row.id) ?? null;
    return note;
  });
}

function overlayPending(store: NotesStore, userId: string, serverNotes: Note[]): Note[] {
  const deletes = new Set(
    store.pending
      .filter((op): op is Extract<PendingOp, { kind: 'delete' }> => op.kind === 'delete')
      .map((op) => op.id),
  );
  const updates = new Map<string, Extract<PendingOp, { kind: 'update' }>>();
  for (const op of store.pending) {
    if (op.kind === 'update') updates.set(op.id, op);
  }

  let list = serverNotes.filter((note) => !deletes.has(note.id));
  list = list.map((note) => {
    const op = updates.get(note.id);
    if (!op) return note;
    return {
      ...note,
      title: op.title ?? note.title,
      content: op.content ?? note.content,
      updatedAt: op.ts,
    };
  });

  const cached = store.cache[userId] ?? [];
  for (const note of cached) {
    if (hasPendingCreate(store, note.id) && !list.some((item) => item.id === note.id)) {
      list.push(note);
    }
  }

  return sortNotes(list);
}

async function runOp(store: NotesStore, op: PendingOp): Promise<'ok' | 'stop' | 'drop'> {
  if (!supabase) return 'stop';

  try {
    if (op.kind === 'create') {
      const payload: Record<string, unknown> = {
        user_id: op.userId,
        title: op.title,
        content: op.content,
      };
      if (typeof op.courseId === 'number') payload.course_id = op.courseId;
      if (typeof op.topicId === 'number') payload.topic_id = op.topicId;

      const { data, error } = await supabase
        .from('notes')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (error) return classify(op, error.message);
      const remoteId = Number((data as { id: number | null } | null)?.id);
      if (!Number.isSafeInteger(remoteId) || remoteId <= 0) return 'drop';
      store.idmap[op.localId] = remoteId;
      return 'ok';
    }

    if (op.kind === 'update') {
      const remoteId = toRemoteId(store, op.id);
      if (remoteId == null) {
        return hasPendingCreate(store, op.id) ? 'stop' : 'drop';
      }
      const values: Record<string, unknown> = {};
      if (op.title != null) values.title = op.title;
      if (op.content != null) values.content = op.content;
      if (Object.keys(values).length === 0) return 'ok';
      values.updated_at = new Date(op.ts).toISOString();

      const { error } = await supabase.from('notes').update(values).eq('id', remoteId);
      if (error) return classify(op, error.message);
      return 'ok';
    }

    const remoteId = toRemoteId(store, op.id);
    if (remoteId == null) {
      return hasPendingCreate(store, op.id) ? 'stop' : 'drop';
    }
    const { error } = await supabase.from('notes').delete().eq('id', remoteId);
    if (error) return classify(op, error.message);
    for (const [localId, mapped] of Object.entries(store.idmap)) {
      if (mapped === remoteId) delete store.idmap[localId];
    }
    return 'ok';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return classify(op, message);
  }
}

function classify(op: PendingOp, message: string): 'ok' | 'stop' | 'drop' {
  if (/fetch|network|timeout|offline|failed to/i.test(message)) {
    return 'stop';
  }
  op.attempts += 1;
  return op.attempts >= MAX_OP_ATTEMPTS ? 'drop' : 'stop';
}

async function flushPending(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const store = await loadStore();
    while (store.pending.length > 0) {
      const op = store.pending[0];
      const result = await runOp(store, op);
      if (result === 'ok') {
        store.pending.shift();
        await persist(store);
        continue;
      }
      if (result === 'drop') {
        store.pending.shift();
        await persist(store);
        continue;
      }
      break;
    }
  } catch {
    // Queue stays intact for the next attempt.
  } finally {
    flushing = false;
  }
}

function enqueue(store: NotesStore, op: PendingOp): void {
  if (op.kind === 'update') {
    const existingDelete = store.pending.find(
      (item) => item.kind === 'delete' && item.id === op.id,
    );
    if (existingDelete) return;

    const existingIdx = store.pending.findIndex(
      (item) => item.kind === 'update' && item.id === op.id,
    );
    if (existingIdx >= 0) {
      const previous = store.pending[existingIdx] as Extract<PendingOp, { kind: 'update' }>;
      store.pending[existingIdx] = {
        kind: 'update',
        id: op.id,
        title: op.title ?? previous.title,
        content: op.content ?? previous.content,
        ts: op.ts,
        attempts: 0,
      };
      return;
    }
  }

  if (op.kind === 'delete') {
    // Never reached the server? Just drop the local create.
    const pendingCreateIdx = store.pending.findIndex(
      (item) => item.kind === 'create' && item.localId === op.id,
    );
    if (pendingCreateIdx >= 0) {
      store.pending.splice(pendingCreateIdx, 1);
      return;
    }
    store.pending = store.pending.filter(
      (item) => !(item.kind === 'update' && item.id === op.id),
    );
  }

  store.pending.push(op);
}

function patchCache(store: NotesStore, userId: string, id: string, patch: Partial<Note>): boolean {
  const list = store.cache[userId];
  if (!list) return false;
  const idx = list.findIndex((note) => note.id === id);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], ...patch };
  return true;
}

export async function fetchNotes(
  userId: string | null,
  scope?: NotesScope,
): Promise<Note[]> {
  if (!userId) return [];

  if (scope?.courseId == null && scope?.topicIds && scope.topicIds.length === 0) {
    return [];
  }

  const store = await loadStore();
  void flushPending();

  if (supabase) {
    try {
      const serverNotes = await fetchRemoteNotes(store, userId, scope);
      store.cache[userId] = overlayPending(store, userId, serverNotes);
      await persist(store);
    } catch {
      // Offline or transient failure: fall through to the local cache.
    }
  }

  const cached = store.cache[userId] ?? [];
  return cached.filter((note) => matchesScope(note, scope));
}

export async function createNote(
  userId: string | null,
  options?: { courseId?: number | null; topicId?: number | null },
): Promise<Note | null> {
  if (!userId) return null;

  const store = await loadStore();

  const note: Note = {
    id: makeLocalId(),
    title: 'Untitled note',
    content: '',
    updatedAt: Date.now(),
    courseId: typeof options?.courseId === 'number' ? options.courseId : null,
    topicId: typeof options?.topicId === 'number' ? options.topicId : null,
    courseTitle: null,
  };

  store.cache[userId] = sortNotes([note, ...(store.cache[userId] ?? [])]);
  enqueue(store, {
    kind: 'create',
    localId: note.id,
    userId,
    title: note.title,
    content: note.content,
    courseId: note.courseId,
    topicId: note.topicId,
    ts: note.updatedAt,
    attempts: 0,
  });
  await persist(store);
  void flushPending();

  return note;
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string },
): Promise<boolean> {
  if (patch.title === undefined && patch.content === undefined) return false;

  const store = await loadStore();

  const ts = Date.now();
  const nextPatch: Partial<Note> = {};
  if (patch.title !== undefined) nextPatch.title = patch.title;
  if (patch.content !== undefined) nextPatch.content = patch.content;
  nextPatch.updatedAt = ts;

  let applied = false;
  for (const userId of Object.keys(store.cache)) {
    if (patchCache(store, userId, id, nextPatch)) applied = true;
  }

  enqueue(store, {
    kind: 'update',
    id,
    title: patch.title ?? null,
    content: patch.content ?? null,
    ts,
    attempts: 0,
  });
  await persist(store);
  void flushPending();

  return applied || supabase != null;
}

export async function deleteNote(id: string): Promise<boolean> {
  const store = await loadStore();

  let removed = false;
  for (const userId of Object.keys(store.cache)) {
    const list = store.cache[userId];
    const next = list.filter((note) => note.id !== id);
    if (next.length !== list.length) {
      store.cache[userId] = next;
      removed = true;
    }
  }

  enqueue(store, { kind: 'delete', id, ts: Date.now(), attempts: 0 });
  await persist(store);
  void flushPending();

  return removed || supabase != null;
}
