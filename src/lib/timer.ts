import AsyncStorage from "@react-native-async-storage/async-storage";

export type TimerMode = "idle" | "running" | "paused";

export interface TimerState {
  mode: TimerMode;
  startedAt: number | null;
  accumulatedMs: number;
  targetMin: number;
  /** Course the current focus time belongs to (focus counter target). */
  courseId: number | null;
  /** Milliseconds of the current session already persisted. */
  flushedMs: number;
}

export interface StudySession {
  id: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
}

const STATE_KEY = "atlas.timer";
const SESSIONS_KEY = "atlas.sessions";
const BASE_KEY = "atlas.focus.base";

const LEGACY_KEYS = [STATE_KEY, SESSIONS_KEY, BASE_KEY];

/** Per-account keys keep one user's timer out of the next user's session. */
function ownerKey(base: string, ownerId?: string | null): string {
  return ownerId ? `${base}.${ownerId}` : base;
}

/**
 * Wipes the local timer/focus caches. Called on sign-out so one account's
 * counters can never bleed into the next session; state is reconciled from
 * the server on the following sign-in. Old unscoped keys are removed too.
 */
export async function clearLocalTimerCache(
  ownerId?: string | null,
): Promise<void> {
  try {
    if (ownerId === undefined) {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(
        keys.filter((key) =>
          LEGACY_KEYS.some(
            (base) => key === base || key.startsWith(`${base}.`),
          ),
        ),
      );
      return;
    }
    await AsyncStorage.multiRemove([
      ...LEGACY_KEYS,
      ...LEGACY_KEYS.map((base) => ownerKey(base, ownerId)),
    ]);
  } catch {
    // Best-effort - a failed clear only means stale local state.
  }
}

export function defaultTimerState(targetMin = 25): TimerState {
  return {
    mode: "idle",
    startedAt: null,
    accumulatedMs: 0,
    targetMin,
    courseId: null,
    flushedMs: 0,
  };
}

export function elapsedMs(state: TimerState, now = Date.now()): number {
  const running =
    state.mode === "running" && state.startedAt !== null
      ? now - state.startedAt
      : 0;
  return state.accumulatedMs + running;
}

export function startTimer(state: TimerState): TimerState {
  if (state.mode === "running") return state;
  return { ...state, mode: "running", startedAt: Date.now() };
}

export function pauseTimer(state: TimerState): TimerState {
  if (state.mode !== "running" || state.startedAt === null) return state;
  const accrued = Date.now() - state.startedAt;
  return {
    ...state,
    mode: "paused",
    startedAt: null,
    accumulatedMs: state.accumulatedMs + accrued,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    mode: "idle",
    startedAt: null,
    accumulatedMs: 0,
    flushedMs: 0,
  };
}

export function setTargetMinutes(state: TimerState, min: number): TimerState {
  return resetTimer({ ...state, targetMin: min });
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Guard rails shared by the on-disk reader (stale / corrupt states). */
function sanitise(parsed: TimerState | null): TimerState {
  if (!parsed || typeof parsed.targetMin !== "number") {
    return defaultTimerState();
  }
  if (parsed.mode === "running" && parsed.startedAt === null) {
    return defaultTimerState(parsed.targetMin);
  }
  if (parsed.mode === "running" && parsed.startedAt !== null) {
    const age = Date.now() - parsed.startedAt;
    if (age > 24 * 60 * 60 * 1000) return defaultTimerState(parsed.targetMin);
  }
  if (parsed.mode === "idle") {
    // Idle never carries elapsed or flushed time over.
    return {
      ...defaultTimerState(parsed.targetMin),
      courseId: typeof parsed.courseId === "number" ? parsed.courseId : null,
    };
  }
  return {
    ...parsed,
    courseId: typeof parsed.courseId === "number" ? parsed.courseId : null,
    flushedMs:
      typeof parsed.flushedMs === "number" && parsed.flushedMs >= 0
        ? parsed.flushedMs
        : 0,
  };
}

export async function loadTimerState(
  ownerId?: string | null,
): Promise<TimerState> {
  try {
    const raw = await AsyncStorage.getItem(ownerKey(STATE_KEY, ownerId));
    if (!raw) return defaultTimerState();
    return sanitise(JSON.parse(raw) as TimerState);
  } catch {
    return defaultTimerState();
  }
}

export function saveTimerState(
  state: TimerState,
  ownerId?: string | null,
): void {
  if (!ownerId) return;
  void AsyncStorage.setItem(
    ownerKey(STATE_KEY, ownerId),
    JSON.stringify(state),
  ).catch(() => undefined);
}

/* ---------------------------------------------------------------
   LOCAL CUMULATIVE BASE: the hero HH:MM:SS counter never restarts
   from zero. Until auth lands, the lifetime base lives on-device.
--------------------------------------------------------------- */

export async function loadFocusBase(
  ownerId?: string | null,
): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ownerKey(BASE_KEY, ownerId));
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveFocusBase(
  seconds: number,
  ownerId?: string | null,
): void {
  if (!ownerId) return;
  void AsyncStorage.setItem(
    ownerKey(BASE_KEY, ownerId),
    String(Math.max(0, Math.floor(seconds))),
  ).catch(() => undefined);
}

/* ---------------------------------------------------------------
   SESSION HISTORY (local log; synced sessions are written to
   learning_sessions from lib/db/sessions.ts).
--------------------------------------------------------------- */

export async function loadSessions(
  ownerId?: string | null,
): Promise<StudySession[]> {
  try {
    const raw = await AsyncStorage.getItem(ownerKey(SESSIONS_KEY, ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudySession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function commitSession(
  state: TimerState,
  ownerId?: string | null,
): Promise<StudySession | null> {
  if (!ownerId) return null;
  const ms = elapsedMs(state);
  if (ms < 60_000) return null;
  const endedAt = Date.now();
  const session: StudySession = {
    id: makeId(),
    startedAt: endedAt - ms,
    endedAt,
    minutes: Math.floor(ms / 60_000),
  };
  const sessions = await loadSessions(ownerId);
  void AsyncStorage.setItem(
    ownerKey(SESSIONS_KEY, ownerId),
    JSON.stringify([...sessions, session].slice(-500)),
  ).catch(() => undefined);
  return session;
}
