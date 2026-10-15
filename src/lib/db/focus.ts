import { commitSession, elapsedMs } from "../timer";
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
  return Math.floor((elapsedMs(state) - state.flushedMs) / 1000);
}

/**
 * Flush the pending delta into the global and course counters.
 * Fire-and-forget-safe: resolves after the queued writes land.
 */
export function flushFocus(state: TimerState): Promise<void> {
  const seconds = pendingSeconds(state);
  if (seconds < 1) return Promise.resolve();

  const courseId = state.courseId;
  return enqueue(async () => {
    await addGlobalFocusSeconds(seconds);
    if (courseId != null) await addFocusSeconds(courseId, seconds);
  }).then(() => undefined);
}

/**
 * Commit a finished session:
 * 1. flush the pending counter delta (global + course), and
 * 2. log the full session into learning_sessions (heatmap + history + XP).
 *
 * Returns the committed session (null when it was under one minute).
 */
export async function commitFocus(
  state: TimerState,
): Promise<StudySession | null> {
  await flushFocus(state);

  const session = await commitSession(state);
  if (session) {
    await enqueue(() =>
      logSession({
        startedAt: new Date(session.startedAt),
        endedAt: new Date(session.endedAt),
        label: "Focus timer",
        courseId: state.courseId,
      }),
    ).then(() => undefined);
  }
  return session;
}
