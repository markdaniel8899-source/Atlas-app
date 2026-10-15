import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getCurrentUserId } from '@/lib/auth';
import { fetchCourseRef } from '@/lib/db/courses';
import { commitFocus, flushFocus } from '@/lib/db/focus';
import { notifyFocusChanged } from '@/lib/db/events';
import { getGlobalFocusSeconds } from '@/lib/db/profile';
import {
  elapsedMs,
  loadTimerState,
  pauseTimer,
  resetTimer,
  saveTimerState,
  setTargetMinutes,
  startTimer,
  subscribeTimer,
} from '@/lib/timer';
import type { TimerState } from '@/lib/timer';
import type { CourseRef } from '@/lib/db/types';
import { cancelFocusEnd, notifyFocusComplete, scheduleFocusEnd } from '@/lib/notifications';
import { toastSuccess } from '@/lib/toast';

export interface SessionCompleteInfo {
  id: number;
  minutes: number;
  message: string;
}

export interface TimerContextValue {
  state: TimerState;
  globalTotal: number;
  progress: number;
  activeCourse: CourseRef | null;
  flash: string | null;
  sessionComplete: SessionCompleteInfo | null;
  dismissSessionComplete: () => void;
  toggle: () => void;
  stop: (message?: string) => void;
  setTarget: (minutes: number) => void;
  startQuick: (minutes: number) => void;
  setCourse: (courseId: number | null) => void;
}

const SESSION_CARD_MS = 8000;

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error('useTimer must be used within <TimerProvider>');
  return value;
}

const IDLE_STATE: TimerState = {
  mode: 'idle',
  startedAt: null,
  accumulatedMs: 0,
  targetMin: 25,
  courseId: null,
  flushedMs: 0,
};

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(IDLE_STATE);
  const [userId, setUserId] = useState<string | null>(null);
  const [globalBase, setGlobalBase] = useState(0);
  const [courseRef, setCourseRef] = useState<CourseRef | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState<SessionCompleteInfo | null>(null);
  const [tick, setTick] = useState(0);

  const stateRef = useRef(state);
  const userIdRef = useRef<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCardIdRef = useRef(0);

  const applyState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void loadTimerState().then((restored) => {
      if (cancelled) return;
      stateRef.current = restored;
      setState(restored);
    });
    void getCurrentUserId().then((uid) => {
      if (!cancelled) setUserId(uid);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveTimerState(state);
  }, [state]);

  useEffect(
    () =>
      subscribeTimer(() => {
        void loadTimerState().then((next) => {
          if (next !== stateRef.current) {
            stateRef.current = next;
            setState(next);
          }
        });
      }),
    [],
  );

  const courseId = state.courseId;
  useEffect(() => {
    let cancelled = false;
    void getGlobalFocusSeconds(userId).then((seconds) => {
      if (!cancelled) setGlobalBase(seconds);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, courseId]);

  useEffect(() => {
    if (!userId || courseId == null) return;
    let cancelled = false;
    void fetchCourseRef(userId, courseId).then((course) => {
      if (!cancelled) setCourseRef(course);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, courseId]);

  useEffect(() => {
    if (state.mode !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.mode]);

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 4000);
  }, []);

  const dismissSessionComplete = useCallback(() => {
    if (sessionCardTimerRef.current) clearTimeout(sessionCardTimerRef.current);
    setSessionComplete(null);
  }, []);

  const showSessionComplete = useCallback((minutes: number, message: string) => {
    sessionCardIdRef.current += 1;
    setSessionComplete({ id: sessionCardIdRef.current, minutes, message });
    if (sessionCardTimerRef.current) clearTimeout(sessionCardTimerRef.current);
    sessionCardTimerRef.current = setTimeout(() => setSessionComplete(null), SESSION_CARD_MS);
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (sessionCardTimerRef.current) clearTimeout(sessionCardTimerRef.current);
    },
    [],
  );

  const toggle = useCallback(() => {
    const current = stateRef.current;
    if (current.mode === 'running') {
      const elapsed = elapsedMs(current);
      const delta = Math.floor((elapsed - current.flushedMs) / 1000);
      if (delta > 0) setGlobalBase((value) => value + delta);
      applyState({ ...pauseTimer(current), flushedMs: elapsed });
      void flushFocus(userIdRef.current, current)
        .then(() => getGlobalFocusSeconds(userIdRef.current))
        .then((seconds) => setGlobalBase(seconds))
        .catch((err) => {
          console.warn('Focus save failed', err);
        });
      return;
    }
    applyState(startTimer(current));
  }, [applyState]);

  const stop = useCallback(
    (message?: string) => {
      const current = stateRef.current;
      if (current.mode === 'idle') return;

      const elapsed = elapsedMs(current);
      const delta = Math.floor((elapsed - current.flushedMs) / 1000);
      if (delta > 0) setGlobalBase((value) => value + delta);
      applyState(resetTimer(current));

      void commitFocus(userIdRef.current, current)
        .then((session) => {
          notifyFocusChanged();
          showFlash(
            message ??
              (session
                ? `Session logged: ${session.minutes} minutes.`
                : 'Stopped - focus still counts toward your total.'),
          );
          if (session && !message) {
            toastSuccess(
              'Session logged',
              `${session.minutes} min focused · +${session.minutes} XP`,
            );
          }
        })
        .catch((err) => {
          console.warn('Focus save failed', err);
        });
    },
    [applyState, showFlash],
  );

  const setTarget = useCallback(
    (minutes: number) => {
      if (stateRef.current.mode !== 'idle') return;
      applyState(setTargetMinutes(stateRef.current, minutes));
    },
    [applyState],
  );

  const startQuick = useCallback(
    (minutes: number) => {
      const current = stateRef.current;
      if (current.mode !== 'idle') return;
      applyState(startTimer(setTargetMinutes(current, minutes)));
    },
    [applyState],
  );

  const setCourse = useCallback(
    (courseId: number | null) => {
      const current = stateRef.current;
      if (current.mode !== 'idle') return;
      applyState({ ...current, courseId });
    },
    [applyState],
  );

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const completionNotifiedRef = useRef(false);
  useEffect(() => {
    if (state.mode !== 'running') completionNotifiedRef.current = false;
  }, [state.mode]);

  const scheduleStatusRef = useRef(true);
  const targetMinRef = useRef(state.targetMin);
  useEffect(() => {
    targetMinRef.current = state.targetMin;
  }, [state.targetMin]);

  useEffect(() => {
    if (state.mode !== 'running' || state.startedAt === null) {
      void cancelFocusEnd();
      return;
    }
    const remainingMs = Math.max(0, state.targetMin * 60_000 - elapsedMs(state));
    const remainingSec = Math.max(1, Math.round(remainingMs / 1000));
    let cancelled = false;
    void scheduleFocusEnd(remainingSec).then((ok) => {
      if (!cancelled) scheduleStatusRef.current = ok;
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    if (state.mode !== 'running') return;
    if (elapsedMs(state) >= state.targetMin * 60_000) {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        void notifyFocusComplete(targetMinRef.current);
        showSessionComplete(
          targetMinRef.current,
          'Target reached - focus time saved to your streak.',
        );
      }
      stopRef.current('Target reached - session logged.');
    }
  }, [state, tick, showSessionComplete]);

  const elapsed = elapsedMs(state);
  const pending = Math.max(0, elapsed - state.flushedMs) / 1000;
  const activeCourse = courseId != null && courseRef?.id === courseId ? courseRef : null;

  const value: TimerContextValue = {
    state,
    globalTotal: globalBase + pending,
    progress: Math.min(1, elapsed / (state.targetMin * 60_000)),
    activeCourse,
    flash,
    sessionComplete,
    dismissSessionComplete,
    toggle,
    stop,
    setTarget,
    startQuick,
    setCourse,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}
