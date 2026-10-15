import AsyncStorage from '@react-native-async-storage/async-storage';

export type TimerMode = 'idle' | 'running' | 'paused';

export interface TimerState {
  mode: TimerMode;
  startedAt: number | null;
  accumulatedMs: number;
  targetMin: number;
  courseId: number | null;
  flushedMs: number;
}

export interface StudySession {
  id: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
}

const STATE_KEY = 'atlas.timer';
const SESSIONS_KEY = 'atlas.sessions';

export function defaultTimerState(targetMin = 25): TimerState {
  return {
    mode: 'idle',
    startedAt: null,
    accumulatedMs: 0,
    targetMin,
    courseId: null,
    flushedMs: 0,
  };
}

export function elapsedMs(state: TimerState, now = Date.now()): number {
  const running =
    state.mode === 'running' && state.startedAt !== null ? now - state.startedAt : 0;
  return state.accumulatedMs + running;
}

export function startTimer(state: TimerState): TimerState {
  if (state.mode === 'running') return state;
  return { ...state, mode: 'running', startedAt: Date.now() };
}

export function pauseTimer(state: TimerState): TimerState {
  if (state.mode !== 'running' || state.startedAt === null) return state;
  const accrued = Date.now() - state.startedAt;
  return {
    ...state,
    mode: 'paused',
    startedAt: null,
    accumulatedMs: state.accumulatedMs + accrued,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    mode: 'idle',
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

type TimerListener = () => void;

const listeners = new Set<TimerListener>();
let cache: TimerState | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTimer(listener: TimerListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalise(parsed: unknown): TimerState {
  const value = parsed as Partial<TimerState> | null;
  if (typeof value?.targetMin !== 'number') return defaultTimerState();
  const mode = value.mode ?? 'idle';
  if (mode === 'running' && value.startedAt == null) {
    return defaultTimerState(value.targetMin);
  }
  if (mode === 'running' && typeof value.startedAt === 'number') {
    const age = Date.now() - value.startedAt;
    if (age > 24 * 60 * 60 * 1000) return defaultTimerState(value.targetMin);
  }
  if (mode === 'idle') {
    return {
      ...defaultTimerState(value.targetMin),
      courseId: typeof value.courseId === 'number' ? value.courseId : null,
    };
  }
  return {
    mode,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : null,
    accumulatedMs: typeof value.accumulatedMs === 'number' ? value.accumulatedMs : 0,
    targetMin: value.targetMin,
    courseId: typeof value.courseId === 'number' ? value.courseId : null,
    flushedMs: typeof value.flushedMs === 'number' && value.flushedMs >= 0 ? value.flushedMs : 0,
  };
}

export async function loadTimerState(): Promise<TimerState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    cache = raw ? normalise(JSON.parse(raw)) : defaultTimerState();
  } catch {
    cache = defaultTimerState();
  }
  return cache;
}

export function saveTimerState(state: TimerState) {
  cache = state;
  void AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => undefined);
  emit();
}

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

async function saveSessions(sessions: StudySession[]) {
  try {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Session history is best-effort.
  }
}

export async function commitSession(state: TimerState): Promise<StudySession | null> {
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
  await saveSessions([...sessions, session]);
  return session;
}
