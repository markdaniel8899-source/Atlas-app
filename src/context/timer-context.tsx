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
import { useActiveCourses } from "../hooks/use-courses";
import { resolveSession, subscribeAuth } from "../lib/auth";
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
import { registerResetHandler } from "../lib/session-reset";
import {
  cancelSessionEndNotification,
  scheduleSessionEndNotification,
} from "../lib/notifications";
import type { Course } from "../lib/db/types";

/** Wall-clock moment the running session reaches its target (null if idle). */
function sessionEndsAt(state: TimerState): number | null {
  if (state.mode !== "running" || state.startedAt === null) return null;
  const remaining = state.targetMin * 60_000 - elapsedMs(state);
  if (remaining <= 0) return null;
  return Date.now() + remaining;
}

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
  const { courses } = useActiveCourses();

  // Actions always read/mutate this synchronously, so double-taps or an
  // auto-complete racing a manual stop can never flush the same delta twice.
  const stateRef = useRef(state);
  const baseRef = useRef(0);
  const courseBaseRef = useRef(0);
  const hydratedRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const hydrateRunRef = useRef(0);
  const completionNotifiedRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const applyState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Hydrate the persisted timer + local lifetime base for one account. Any
  // in-flight run is invalidated when the owner changes again (sign-out or a
  // different account), so a late response can never overwrite the new user.
  const hydrateForOwner = useCallback(async (ownerId: string | null) => {
    const run = ++hydrateRunRef.current;
    ownerRef.current = ownerId;
    hydratedRef.current = false;

    // Drop the previous account's live state immediately.
    const fresh = defaultTimerState();
    stateRef.current = fresh;
    baseRef.current = 0;
    courseBaseRef.current = 0;
    completionNotifiedRef.current = false;
    setState(fresh);
    setGlobalBase(0);
    setCourseBase(0);
    setFlash(null);
    setShowCompletionCard(false);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = null;
    if (completionCardTimerRef.current)
      clearTimeout(completionCardTimerRef.current);
    completionCardTimerRef.current = null;
    void cancelSessionEndNotification();

    if (!ownerId) {
      hydratedRef.current = true;
      return;
    }

    const [stored, base] = await Promise.all([
      loadTimerState(ownerId),
      loadFocusBase(ownerId),
    ]);
    if (run !== hydrateRunRef.current || ownerRef.current !== ownerId) return;

    stateRef.current = stored;
    baseRef.current = base;
    setState(stored);
    setGlobalBase(base);
    hydratedRef.current = true;

    // Keep the end-of-session alert in sync with a persisted run.
    const endsAt = sessionEndsAt(stored);
    if (endsAt) void scheduleSessionEndNotification(endsAt);
    else void cancelSessionEndNotification();

    const serverSeconds = await getGlobalFocusSeconds();
    if (run !== hydrateRunRef.current || ownerRef.current !== ownerId) return;
    if (serverSeconds > baseRef.current) {
      baseRef.current = serverSeconds;
      setGlobalBase(serverSeconds);
      saveFocusBase(serverSeconds, ownerId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void resolveSession()
      .then((user) => {
        if (!cancelled) void hydrateForOwner(user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) void hydrateForOwner(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrateForOwner]);

  useEffect(
    () =>
      subscribeAuth((user) => {
        const next = user?.id ?? null;
        if (next === ownerRef.current) return;
        void hydrateForOwner(next);
      }),
    [hydrateForOwner],
  );

  // Sign-out resets every registered store; keep the timer in that set.
  useEffect(
    () =>
      registerResetHandler(() => {
        void hydrateForOwner(null);
      }),
    [hydrateForOwner],
  );

  /** Pull the account's lifetime total after sign-in / refresh. */
  const syncGlobalBase = useCallback(async () => {
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    const serverSeconds = await getGlobalFocusSeconds();
    if (ownerId !== ownerRef.current) return;
    if (serverSeconds > baseRef.current) {
      baseRef.current = serverSeconds;
      setGlobalBase(serverSeconds);
      saveFocusBase(serverSeconds, ownerId);
    }
  }, []);

  /** Fresh course counter (courses.total_focus_seconds). */
  const reloadCourseBase = useCallback(async (courseId: number | null) => {
    const ownerId = ownerRef.current;
    const seconds = await getFocusSeconds(courseId);
    if (ownerId !== ownerRef.current) return;
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
    if (hydratedRef.current && ownerRef.current) {
      saveTimerState(state, ownerRef.current);
    }
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
    if (ownerRef.current) saveFocusBase(next, ownerRef.current);

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
      void cancelSessionEndNotification();
      void flushFocus(current)
        .then(() => {
          void reloadCourseBase(current.courseId);
          notifyFocusChanged();
        })
        .catch((err) =>
          console.error(
            "Focus save failed:",
            err instanceof Error ? err.message : String(err),
          ),
        );
      return;
    }
    if (current.mode === "idle") void reloadCourseBase(current.courseId);
    const next = startTimer(current);
    applyState(next);
    const endsAt = sessionEndsAt(next);
    if (endsAt) void scheduleSessionEndNotification(endsAt);
  }, [applyState, bumpBase, reloadCourseBase]);

  const stop = useCallback(
    (message?: string) => {
      const current = stateRef.current;
      if (current.mode === "idle") return;

      const elapsed = elapsedMs(current);
      const delta = Math.floor((elapsed - current.flushedMs) / 1000);
      bumpBase(delta);
      applyState(resetTimer(current));
      void cancelSessionEndNotification();

      void commitFocus(current)
        .then((result) => {
          setHistoryVersion((version) => version + 1);
          if (result.countersSynced) void reloadCourseBase(current.courseId);
          notifyFocusChanged();
          const synced = result.logged && result.countersSynced;
          showFlash(
            result.session
              ? synced
                ? message ??
                  `Session logged: ${result.session.minutes} minutes.`
                : "No internet - session kept locally, cloud sync failed."
              : "Stopped - focus still counts toward your total.",
          );
        })
        .catch((err) => {
          console.error(
            "Focus save failed:",
            err instanceof Error ? err.message : String(err),
          );
          notifyFocusChanged();
          showFlash("No internet - session kept locally, cloud sync failed.");
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
      const next = startTimer(setTargetMinutes(current, minutes));
      applyState(next);
      void reloadCourseBase(current.courseId);
      const endsAt = sessionEndsAt(next);
      if (endsAt) void scheduleSessionEndNotification(endsAt);
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
