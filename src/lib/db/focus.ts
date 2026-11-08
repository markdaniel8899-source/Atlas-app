import { queueFocusSession, queueFocusSync } from "../focus-queue";
import { commitSession, sessionElapsedMs } from "../timer";
import type { StudySession, TimerState } from "../timer";
import { addFocusSeconds } from "./courses";
import { addGlobalFocusSeconds } from "./profile";
import { logSession } from "./sessions";

/**
 * Write the not-yet-persisted focus delta of the current session into BOTH
 * cumulative counters (profiles global + courses per-course). Calls are
 * queued so pause/resume cycles never interleave read-modify-write races.
 *
 * `state` must be captured at the transition moment (pause, stop, finish),
 * not inside a later render.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue(task: () => Promise<unknown>): Promise<unknown> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

/** Delta seconds accumulated since the last flush. */
function pendingSeconds(state: TimerState): number {
  return Math.floor((sessionElapsedMs(state) - state.flushedMs) / 1000);
}

/**
 * Flush the pending delta into the global and course counters.
 *
 * Resolves true when both counters reached the server. A failed write is
 * handed to the persistent focus queue instead of being dropped, so offline
 * study time still reaches the heatmap and lifetime totals later.
 */
export function flushFocus(state: TimerState): Promise<boolean> {
  const seconds = pendingSeconds(state);
  if (seconds < 1) return Promise.resolve(true);

  const courseId = state.courseId;
  return enqueue(async () => {
    let globalOk = false;
    let courseOk = true;
    try {
      globalOk = await addGlobalFocusSeconds(seconds);
    } catch {
      globalOk = false;
    }
    if (courseId != null) {
      try {
        courseOk = await addFocusSeconds(courseId, seconds);
      } catch {
        courseOk = false;
      }
    }
    if (!globalOk || !courseOk) {
      queueFocusSync({
        seconds,
        courseId,
        global: !globalOk,
        course: !courseOk,
      });
    }
    return globalOk && courseOk;
  }).then(
    (value) => value === true,
    () => false,
  );
}

export interface CommitFocusResult {
  /** The committed session (null when it was under one minute). */
  session: StudySession | null;
  /** False when the global/course counters could not reach the server. */
  countersSynced: boolean;
  /** False when learning_sessions/XP could not be written (offline etc.). */
  logged: boolean;
}

/**
 * Commit a finished session:
 * 1. flush the pending counter delta (global + course), and
 * 2. log the full session into learning_sessions (heatmap + history + XP).
 *
 * Never throws: anything that cannot reach the server is queued on disk and
 * retried automatically, so a session is never lost.
 */
export async function commitFocus(
  state: TimerState,
): Promise<CommitFocusResult> {
  const countersSynced = await flushFocus(state);

  const session = await commitSession(state);
  let logged = false;
  if (session) {
    const entry = {
      startedAt: new Date(session.startedAt),
      endedAt: new Date(session.endedAt),
      label: "Focus timer",
      courseId: state.courseId,
    };
    try {
      logged = Boolean(await enqueue(() => logSession(entry)));
    } catch {
      logged = false;
    }
    if (!logged) queueFocusSession(entry);
  }
  return { session, countersSynced, logged };
}
