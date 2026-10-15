import { commitSession, elapsedMs } from '@/lib/timer';
import type { StudySession, TimerState } from '@/lib/timer';

import { addFocusSeconds } from './courses';
import { addGlobalFocusSeconds } from './profile';
import { logSession } from './sessions';

let queue: Promise<unknown> = Promise.resolve();

function enqueue(task: () => Promise<unknown>): Promise<unknown> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

function pendingSeconds(state: TimerState): number {
  return Math.floor((elapsedMs(state) - state.flushedMs) / 1000);
}

export function flushFocus(userId: string | null, state: TimerState): Promise<void> {
  const seconds = pendingSeconds(state);
  if (seconds < 1 || !userId) return Promise.resolve();

  const courseId = state.courseId;
  return enqueue(async () => {
    await addGlobalFocusSeconds(userId, seconds);
    if (courseId != null) await addFocusSeconds(userId, courseId, seconds);
  }).then(() => undefined);
}

export async function commitFocus(
  userId: string | null,
  state: TimerState,
): Promise<StudySession | null> {
  await flushFocus(userId, state);

  const session = await commitSession(state);
  if (session && userId) {
    await enqueue(() =>
      logSession({
        startedAt: new Date(session.startedAt),
        endedAt: new Date(session.endedAt),
        label: 'Focus timer',
        courseId: state.courseId,
      }),
    ).then(() => undefined);
  }
  return session;
}
