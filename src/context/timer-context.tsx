import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useCourses } from "../hooks/use-courses";
import { subscribeAuth } from "../lib/auth";
import { commitFocus, flushFocus } from "../lib/db/focus";
import { getFocusSeconds } from "../lib/db/courses";
import { getGlobalFocusSeconds } from "../lib/db/profile";
import {
  defaultTimerState,
  elapsedMs,
  loadFocusBase,
  loadTimerState,
  pauseTimer,
  resetTimer,
  saveFocusBase,
  saveTimerState,
  setTargetMinutes,
  startTimer,
} from "../lib/timer";
import type { TimerState } from "../lib/timer";
import { notifyFocusChanged } from "../lib/events";
import type { Course } from "../lib/db/types";

export interface TimerContextValue {
  state: TimerState;
  /**
   * Lifetime focus seconds (local base + pending live time). This is the
   * hero HH:MM:SS counter - it never restarts from zero.
   */
  globalTotal: number;
  /** Lifetime focus seconds for the selected course (0 when none). */
  courseTotal: number;
  /** Progress toward the current target, 0..1. */
  progress: number;
  /** Course the session belongs to (title shown as "Focusing on: ..."). */
  activeCourse: Course | null;
  flash: string | null;
  /** Bumped after every commit - lets lists refetch session history. */
  historyVersion: number;
  /** Start when idle, resume when paused, pause when running. */
  toggle: () => void;
  /** Commit: bump counters + log the session + reset to idle. */
  stop: (message?: string) => void;
  setTarget: (minutes: number) => void;
  /** Pre-select a course (only while idle). */
  selectCourse: (courseId: number | null) => void;
  /** Set a target and start immediately. */
  startQuick: (minutes: number) => void;
  /** Bottom "Session Complete!" card (8s auto-hide, dismissible). */
  showCompletionCard: boolean;
  dismissCompletionCard: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimer must be used within <TimerProvider>");
  return value;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(() => defaultTimerState());
  const [globalBase, setGlobalBase] = useState(0);
  const [courseBase, setCourseBase] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [tick, setTick] = useState(0);
  const [showCompletionCard, setShowCompletionCard] = useState(false);
  const { courses } = useCourses();

  // Actions always read/mutate this synchronously, so double-taps or an
  // auto-complete racing a manual stop can never flush the same delta twice.
  const stateRef = useRef(state);
  const baseRef = useRef(0);
  const courseBaseRef = useRef(0);
  const hydratedRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const applyState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Hydrate the persisted timer + local lifetime base once on mount, then
  // reconcile with the account's lifetime total from Supabase.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, base] = await Promise.all([
        loadTimerState(),
        loadFocusBase(),
      ]);
      if (cancelled) return;
      hydratedRef.current = true;
      stateRef.current = stored;
      baseRef.current = base;
      setState(stored);
      setGlobalBase(base);

      const serverSeconds = await getGlobalFocusSeconds();
      if (cancelled || serverSeconds <= baseRef.current) return;
      baseRef.current = serverSeconds;
      setGlobalBase(serverSeconds);
      saveFocusBase(serverSeconds);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Pull the account's lifetime total after sign-in / refresh. */
  const syncGlobalBase = useCallback(async () => {
    const serverSeconds = await getGlobalFocusSeconds();
    if (serverSeconds > baseRef.current) {
      baseRef.current = serverSeconds;
      setGlobalBase(serverSeconds);
      saveFocusBase(serverSeconds);
    }
  }, []);

  /** Fresh course counter (courses.total_focus_seconds). */
  const reloadCourseBase = useCallback(async (courseId: number | null) => {
    const seconds = await getFocusSeconds(courseId);
    if (courseId !== stateRef.current.courseId) return;
    courseBaseRef.current = seconds;
    setCourseBase(seconds);
  }, []);

  // Read the cumulative counter from the database whenever the target
  // course changes.
  const courseId = state.courseId;
  useEffect(() => {
    void reloadCourseBase(courseId);
  }, [courseId, reloadCourseBase]);

  useEffect(
    () =>
      subscribeAuth((user) => {
        if (user) void syncGlobalBase();
      }),
    [syncGlobalBase],
  );

  // Persist every transition (app restarts keep the timer alive via this).
  useEffect(() => {
    if (hydratedRef.current) saveTimerState(state);
  }, [state]);

  // Single 1Hz tick for every consumer while the timer runs.
  useEffect(() => {
    if (state.mode !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.mode]);

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (completionCardTimerRef.current)
        clearTimeout(completionCardTimerRef.current);
    },
    [],
  );

  /** Bump the local lifetime base (optimistic, keeps the hero continuous). */
  const bumpBase = useCallback((delta: number) => {
    if (delta <= 0) return;
    const next = baseRef.current + delta;
    baseRef.current = next;
    setGlobalBase(next);
    saveFocusBase(next);

    if (stateRef.current.courseId != null) {
      courseBaseRef.current += delta;
      setCourseBase(courseBaseRef.current);
    }
  }, []);

  const toggle = useCallback(() => {
    const current = stateRef.current;
    if (current.mode === "running") {
      const elapsed = elapsedMs(current);
      const delta = Math.floor((elapsed - current.flushedMs) / 1000);
      bumpBase(delta);
      applyState({ ...pauseTimer(current), flushedMs: elapsed });
      void flushFocus(current)
        .then(() => {
          void reloadCourseBase(current.courseId);
          notifyFocusChanged();
        })
        .catch((err) => console.error("Focus save failed", err));
      return;
    }
    if (current.mode === "idle") void reloadCourseBase(current.courseId);
    applyState(startTimer(current));
  }, [applyState, bumpBase, reloadCourseBase]);

  const stop = useCallback(
    (message?: string) => {
      const current = stateRef.current;
      if (current.mode === "idle") return;

      const elapsed = elapsedMs(current);
      const delta = Math.floor((elapsed - current.flushedMs) / 1000);
      bumpBase(delta);
      applyState(resetTimer(current));

      void commitFocus(current)
        .then((session) => {
          setHistoryVersion((version) => version + 1);
          void reloadCourseBase(current.courseId);
          notifyFocusChanged();
          showFlash(
            message ??
              (session
                ? `Session logged: ${session.minutes} minutes.`
                : "Stopped - focus still counts toward your total."),
          );
        })
        .catch((err) => {
          console.error("Focus save failed", err);
          notifyFocusChanged();
        });
    },
    [applyState, bumpBase, showFlash, reloadCourseBase],
  );

  const setTarget = useCallback(
    (minutes: number) => {
      if (stateRef.current.mode !== "idle") return;
      applyState(setTargetMinutes(stateRef.current, minutes));
    },
    [applyState],
  );

  const selectCourse = useCallback(
    (nextCourseId: number | null) => {
      const current = stateRef.current;
      if (current.mode !== "idle" || current.courseId === nextCourseId) return;
      applyState({ ...current, courseId: nextCourseId });
    },
    [applyState],
  );

  const startQuick = useCallback(
    (minutes: number) => {
      const current = stateRef.current;
      if (current.mode !== "idle") return;
      applyState(startTimer(setTargetMinutes(current, minutes)));
      void reloadCourseBase(current.courseId);
    },
    [applyState, reloadCourseBase],
  );

  const dismissCompletionCard = useCallback(() => {
    setShowCompletionCard(false);
    if (completionCardTimerRef.current) {
      clearTimeout(completionCardTimerRef.current);
      completionCardTimerRef.current = null;
    }
  }, []);

  // Auto-complete when the target is reached (single owner for every view).
  // `tick` is a dep so the check re-runs every second while running.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  // One-shot: the completion card shows exactly once per session.
  const completionNotifiedRef = useRef(false);
  useEffect(() => {
    if (state.mode !== "running") completionNotifiedRef.current = false;
  }, [state.mode]);
  useEffect(() => {
    if (state.mode !== "running") return;
    if (elapsedMs(state) >= state.targetMin * 60_000) {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        setShowCompletionCard(true);
        if (completionCardTimerRef.current)
          clearTimeout(completionCardTimerRef.current);
        completionCardTimerRef.current = setTimeout(() => {
          setShowCompletionCard(false);
          completionCardTimerRef.current = null;
        }, 8000);
      }
      stopRef.current("Target reached - session logged.");
    }
  }, [state, tick]);

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === state.courseId) ?? null,
    [courses, state.courseId],
  );

  const value: TimerContextValue = useMemo(() => {
    const elapsed = elapsedMs(state);
    const pending = Math.max(0, elapsed - state.flushedMs) / 1000;
    return {
      state,
      globalTotal: globalBase + pending,
      courseTotal: state.courseId != null ? courseBase + pending : 0,
      progress: Math.min(1, elapsed / (state.targetMin * 60_000)),
      activeCourse,
      flash,
      historyVersion,
      toggle,
      stop,
      setTarget,
      selectCourse,
      startQuick,
      showCompletionCard,
      dismissCompletionCard,
    };
    // Recomputes elapsed/globalTotal every second while the timer runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    tick,
    globalBase,
    courseBase,
    activeCourse,
    flash,
    historyVersion,
    toggle,
    stop,
    setTarget,
    selectCourse,
    startQuick,
    showCompletionCard,
    dismissCompletionCard,
  ]);

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
