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

export async function loadTimerState(): Promise<TimerState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return defaultTimerState();
    return sanitise(JSON.parse(raw) as TimerState);
  } catch {
    return defaultTimerState();
  }
}

export function saveTimerState(state: TimerState): void {
  void AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(
    () => undefined,
  );
}

/* ---------------------------------------------------------------
   LOCAL CUMULATIVE BASE: the hero HH:MM:SS counter never restarts
   from zero. Until auth lands, the lifetime base lives on-device.
--------------------------------------------------------------- */

export async function loadFocusBase(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BASE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveFocusBase(seconds: number): void {
  void AsyncStorage.setItem(
    BASE_KEY,
    String(Math.max(0, Math.floor(seconds))),
  ).catch(() => undefined);
}

/* ---------------------------------------------------------------
   SESSION HISTORY (local log; mirrors the web behaviour until the
   learning_sessions table is wired up for the app).
--------------------------------------------------------------- */

export async function loadSessions(): Promise<StudySession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudySession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function commitSession(
  state: TimerState,
): Promise<StudySession | null> {
  const ms = elapsedMs(state);
  if (ms < 60_000) return null;
  const endedAt = Date.now();
  const session: StudySession = {
    id: makeId(),
    startedAt: endedAt - ms,
    endedAt,
    minutes: Math.floor(ms / 60_000),
  };
  const sessions = await loadSessions();
  void AsyncStorage.setItem(
    SESSIONS_KEY,
    JSON.stringify([...sessions, session].slice(-500)),
  ).catch(() => undefined);
  return session;
}
