import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { deleteNote, insertNote, updateNote } from "./db/notes";

const STORAGE_KEY = "atlas.notes.queue.v1";
const RETRY_INTERVAL_MS = 15000;
/** Coalesces keystroke bursts before hitting the network. */
const FLUSH_DELAY_MS = 600;

export function isTempNoteId(id: string): boolean {
  return id.startsWith("local-");
}

export function makeTempNoteId(): string {
  return `local-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

interface QueueOp {
  noteId: string;
  op: "upsert" | "delete";
  title: string;
  html: string;
  courseId: number | null;
  topicId: number | null;
  updatedAt: number;
}

export interface NotesQueueSnapshot {
  pending: number;
  /** Temp note ids ("local-…") with an insert still waiting in the queue. */
  tempIds: string[];
  syncing: boolean;
}

/**
 * Persistent offline queue for note writes. Saves land here first (latest
 * write per note wins), then flush one-by-one to Supabase. A failed flush
 * (no internet) keeps the queue on disk and retries on: the next edit, a
 * 15s interval while work remains, and every app foreground.
 */
const ops = new Map<string, QueueOp>();
let snapshot: NotesQueueSnapshot = { pending: 0, tempIds: [], syncing: false };
let flushing = false;
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const swapHandlers = new Set<(tempId: string, realId: string) => void>();

function buildSnapshot(): NotesQueueSnapshot {
  const tempIds: string[] = [];
  for (const op of ops.values()) {
    if (op.op === "upsert" && isTempNoteId(op.noteId)) tempIds.push(op.noteId);
  }
  return { pending: ops.size, tempIds, syncing: flushing };
}

function emit() {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

function persistOps() {
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...ops.values()]),
  ).catch(() => undefined);
}

function ensureRetryTimer() {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    void flushNotesQueue();
  }, RETRY_INTERVAL_MS);
}

function stopRetryTimer() {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNotesQueue();
  }, FLUSH_DELAY_MS);
}

async function hydrateQueue() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed as QueueOp[]) {
          if (
            entry &&
            typeof entry.noteId === "string" &&
            (entry.op === "upsert" || entry.op === "delete")
          ) {
            ops.set(entry.noteId, {
              noteId: entry.noteId,
              op: entry.op,
              title: typeof entry.title === "string" ? entry.title : "",
              html: typeof entry.html === "string" ? entry.html : "",
              courseId:
                typeof entry.courseId === "number" ? entry.courseId : null,
              topicId:
                typeof entry.topicId === "number" ? entry.topicId : null,
              updatedAt:
                typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
            });
          }
        }
      }
    }
  } catch {
    // Corrupt payload - start fresh.
  }
  emit();
  if (ops.size > 0) {
    ensureRetryTimer();
    void flushNotesQueue();
  }
}

let appStateBound = false;
function bindAppState() {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener("change", (status) => {
    if (status === "active") void flushNotesQueue();
  });
}

export function subscribeNotesQueue(listener: () => void): () => void {
  bindAppState();
  void hydrateQueue();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotesQueueSnapshot(): NotesQueueSnapshot {
  return snapshot;
}

export function registerNoteIdSwap(
  handler: (tempId: string, realId: string) => void,
): () => void {
  swapHandlers.add(handler);
  return () => {
    swapHandlers.delete(handler);
  };
}

export function queueNoteUpsert(note: {
  id: string;
  title: string;
  html: string;
  courseId: number | null;
  topicId: number | null;
}) {
  ops.set(note.id, {
    noteId: note.id,
    op: "upsert",
    title: note.title,
    html: note.html,
    courseId: note.courseId,
    topicId: note.topicId,
    updatedAt: Date.now(),
  });
  persistOps();
  emit();
  ensureRetryTimer();
  scheduleFlush();
}

export function queueNoteDelete(id: string) {
  if (isTempNoteId(id)) {
    // Never reached the server (and any queued insert must not happen).
    ops.delete(id);
    persistOps();
    emit();
    return;
  }
  ops.set(id, {
    noteId: id,
    op: "delete",
    title: "",
    html: "",
    courseId: null,
    topicId: null,
    updatedAt: Date.now(),
  });
  persistOps();
  emit();
  ensureRetryTimer();
  scheduleFlush();
}

function dropIfSame(key: string, op: QueueOp) {
  if (ops.get(key) === op) {
    ops.delete(key);
    persistOps();
    emit();
  }
}

export async function flushNotesQueue(): Promise<void> {
  await hydrateQueue();
  if (flushing || ops.size === 0) {
    if (ops.size === 0) stopRetryTimer();
    return;
  }
  flushing = true;
  emit();
  try {
    while (ops.size > 0) {
      const first = ops.entries().next();
      if (first.done) break;
      const [key, op] = first.value;

      if (op.op === "delete") {
        if (isTempNoteId(op.noteId)) {
          dropIfSame(key, op);
          continue;
        }
        const ok = await deleteNote(op.noteId);
        if (!ok) break;
        dropIfSame(key, op);
        continue;
      }

      if (isTempNoteId(op.noteId)) {
        const created = await insertNote({
          title: op.title,
          html: op.html,
          courseId: op.courseId,
          topicId: op.topicId,
        });
        if (!created) break;
        const latest = ops.get(key);
        if (latest && latest !== op) {
          // The user kept typing while the insert was in flight: re-key the
          // newer edits onto the real row id and let them flush as updates.
          ops.delete(key);
          ops.set(created.id, { ...latest, noteId: created.id });
        } else {
          ops.delete(key);
        }
        persistOps();
        for (const handler of swapHandlers) handler(op.noteId, created.id);
        emit();
        continue;
      }

      const ok = await updateNote(op.noteId, {
        title: op.title,
        html: op.html,
      });
      if (!ok) break;
      dropIfSame(key, op);
    }
  } finally {
    flushing = false;
    persistOps();
    emit();
    if (ops.size > 0) ensureRetryTimer();
    else stopRetryTimer();
  }
}
