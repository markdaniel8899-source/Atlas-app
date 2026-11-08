import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { subscribeAuth } from "./auth";
import { getAuthSnapshot, hydrateAuthSnapshot } from "./auth-snapshot";
import { addFocusSeconds } from "./db/courses";
import { addGlobalFocusSeconds } from "./db/profile";
import { logSession } from "./db/sessions";
import type { SessionLog } from "./db/sessions";
import { diag } from "./diagnostics";
import { isOnline, subscribeNetwork } from "./net";

/**
 * Persistent queue for focus writes that could not reach the server (offline
 * pause/resume flushes and finished sessions). Focus time used to be lost
 * server-side whenever a write failed; now the delta waits here and flushes
 * one-by-one once the connection returns, so the heatmap, streak and lifetime
 * counters catch up.
 *
 * Ops are owner-scoped like the notes queue: one account's pending work never
 * flushes into the next account's row.
 */

const STORAGE_KEY = "atlas.focus.queue.v1";
const RETRY_INTERVAL_MS = 30000;
const FLUSH_DELAY_MS = 500;
/**
 * Drop an op after this many failed attempts while the device is online.
 * Generous on purpose: an expired access token right after a long offline
 * stretch can fail a few times before the refresh lands.
 */
const MAX_ATTEMPTS = 30;
const MAX_SESSION_OPS = 200;

interface BaseOp {
  id: string;
  ownerId: string | null;
  attempts: number;
  queuedAt: number;
}

interface SecondsOp extends BaseOp {
  kind: "global" | "course";
  seconds: number;
  /** Only for kind "course". */
  courseId?: number;
}

interface SessionOp extends BaseOp {
  kind: "session";
  startedAt: number;
  endedAt: number;
  courseId: number | null;
  topicId: number | null;
  label: string;
}

type FocusOp = SecondsOp | SessionOp;

let ops: FocusOp[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;
let flushing = false;
let currentOwnerId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;

function makeId(): string {
  return `fq-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function ownOps(): FocusOp[] {
  if (!currentOwnerId) return [];
  return ops.filter((op) => op.ownerId === currentOwnerId);
}

function adoptUnownedOps(): void {
  if (!currentOwnerId) return;
  let changed = false;
  for (const op of ops) {
    if (!op.ownerId) {
      op.ownerId = currentOwnerId;
      changed = true;
    }
  }
  if (changed) persistOps();
}

function persistOps(): void {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops)).catch(
    () => undefined,
  );
}

function hydrateQueue(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    // Ops queued before the disk read finished must survive the merge.
    const queuedEarly = ops;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const stored = parsed.filter(
            (op): op is FocusOp =>
              Boolean(op) &&
              typeof op === "object" &&
              typeof (op as FocusOp).id === "string" &&
              typeof (op as FocusOp).kind === "string",
          );
          const earlyIds = new Set(queuedEarly.map((op) => op.id));
          ops = [...stored.filter((op) => !earlyIds.has(op.id)), ...queuedEarly];
        }
      }
    } catch {
      // Corrupt payload - keep only the ops queued this run.
    }
    hydrated = true;
    adoptUnownedOps();
    if (ownOps().length > 0) {
      ensureRetryTimer();
      scheduleFlush();
    }
  })();
  return hydrating;
}

function ensureRetryTimer(): void {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    if (ownOps().length === 0) {
      stopRetryTimer();
      return;
    }
    void flushFocusQueue();
  }, RETRY_INTERVAL_MS);
}

function stopRetryTimer(): void {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushFocusQueue();
  }, FLUSH_DELAY_MS);
}

/** A focus counter delta that could not be written to the server. */
export function queueFocusSync(input: {
  seconds: number;
  courseId: number | null;
  /** Queue the global lifetime counter delta. */
  global: boolean;
  /** Queue the per-course counter delta. */
  course: boolean;
}): void {
  const seconds = Math.floor(input.seconds);
  if (seconds < 1) return;

  if (input.global) {
    const existing = ops.find(
      (op) =>
        op.kind === "global" &&
        op.ownerId === currentOwnerId &&
        op.attempts === 0,
    ) as SecondsOp | undefined;
    if (existing) {
      existing.seconds += seconds;
    } else {
      ops.push({
        id: makeId(),
        kind: "global",
        seconds,
        ownerId: currentOwnerId,
        attempts: 0,
        queuedAt: Date.now(),
      });
    }
  }

  if (input.course && input.courseId != null) {
    const courseId = input.courseId;
    const existing = ops.find(
      (op) =>
        op.kind === "course" &&
        op.ownerId === currentOwnerId &&
        op.courseId === courseId &&
        op.attempts === 0,
    ) as SecondsOp | undefined;
    if (existing) {
      existing.seconds += seconds;
    } else {
      ops.push({
        id: makeId(),
        kind: "course",
        seconds,
        courseId,
        ownerId: currentOwnerId,
        attempts: 0,
        queuedAt: Date.now(),
      });
    }
  }

  persistOps();
  ensureRetryTimer();
  scheduleFlush();
}

/** A finished session (heatmap + history + XP) that could not be logged. */
export function queueFocusSession(entry: SessionLog): void {
  const seconds = Math.round(
    (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
  );
  // Sessions under a minute are not logged by design (see logSession).
  if (seconds < 60) return;

  ops.push({
    id: makeId(),
    kind: "session",
    startedAt: entry.startedAt.getTime(),
    endedAt: entry.endedAt.getTime(),
    courseId: entry.courseId ?? null,
    topicId: entry.topicId ?? null,
    label: entry.label ?? "Focus timer",
    ownerId: currentOwnerId,
    attempts: 0,
    queuedAt: Date.now(),
  });

  // Cap only this account's unsynced sessions so another account's pending
  // work can never be evicted.
  const sessions = ops.filter(
    (op) => op.kind === "session" && op.ownerId === currentOwnerId,
  );
  if (sessions.length > MAX_SESSION_OPS) {
    const drop = new Set(
      sessions
        .sort((a, b) => a.queuedAt - b.queuedAt)
        .slice(0, sessions.length - MAX_SESSION_OPS)
        .map((op) => op.id),
    );
    ops = ops.filter((op) => !drop.has(op.id));
  }

  persistOps();
  ensureRetryTimer();
  scheduleFlush();
}

function removeOp(id: string): void {
  const index = ops.findIndex((op) => op.id === id);
  if (index >= 0) {
    ops.splice(index, 1);
    // Persist after every removal so a crash mid-flush cannot replay an op
    // that already reached the server.
    persistOps();
  }
}

async function runOp(op: FocusOp): Promise<boolean> {
  try {
    if (op.kind === "global") return await addGlobalFocusSeconds(op.seconds);
    if (op.kind === "course") {
      if (op.courseId == null) return true;
      return await addFocusSeconds(op.courseId, op.seconds);
    }
    if (op.kind !== "session") return true;
    return await logSession({
      startedAt: new Date(op.startedAt),
      endedAt: new Date(op.endedAt),
      label: op.label,
      courseId: op.courseId,
      topicId: op.topicId,
    });
  } catch (error) {
    diag("focus-queue:op-fail", {
      kind: op.kind,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function flushFocusQueue(): Promise<void> {
  await hydrateQueue();
  if (flushing) return;
  if (ownOps().length === 0) {
    stopRetryTimer();
    return;
  }
  // Offline attempts must not burn the retry budget: keep the ops untouched
  // until the device actually has a connection.
  if (!(await isOnline())) return;

  flushing = true;
  try {
    // Snapshot: removals mutate `ops` while we iterate.
    const batch = ownOps();
    for (const op of batch) {
      // The op may have been dropped or claimed by another owner meanwhile.
      if (!ops.includes(op)) continue;
      const ok = await runOp(op);
      if (ok) {
        removeOp(op.id);
        continue;
      }
      if (!(await isOnline())) break;
      op.attempts += 1;
      if (op.attempts >= MAX_ATTEMPTS) {
        diag("focus-queue:drop", { kind: op.kind, attempts: op.attempts });
        removeOp(op.id);
        continue;
      }
      persistOps();
      // Stop at the first retryable failure; the next tick tries again.
      break;
    }
  } finally {
    flushing = false;
    if (ownOps().length === 0) stopRetryTimer();
    else ensureRetryTimer();
  }
}

/** Unsent focus writes for the signed-in account (for diagnostics/UI). */
export function pendingFocusOps(): number {
  return ownOps().length;
}

subscribeAuth((user) => {
  const next = user?.id ?? null;
  if (next === currentOwnerId) return;
  currentOwnerId = next;
  adoptUnownedOps();
  void flushFocusQueue();
});

// Prime the owner from the persisted auth snapshot on an offline cold start.
void (async () => {
  await hydrateAuthSnapshot();
  const user = getAuthSnapshot();
  if (user && user.id !== currentOwnerId) {
    currentOwnerId = user.id;
    adoptUnownedOps();
  }
  await hydrateQueue();
  void flushFocusQueue();
})();

// Static web prerender runs in Node, where AppState reads `document`.
if (typeof window !== "undefined") {
  AppState.addEventListener("change", (status) => {
    if (status === "active") void flushFocusQueue();
  });
}

subscribeNetwork((online) => {
  if (online) void flushFocusQueue();
});
