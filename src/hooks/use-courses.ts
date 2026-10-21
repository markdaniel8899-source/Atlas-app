import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readCache, writeCache } from "../lib/data-cache";
import { fetchCourses } from "../lib/db/courses";
import { COURSES_CHANGED_EVENT, FOCUS_CHANGED_EVENT, listen } from "../lib/events";
import { useFocusedEvent } from "./use-focused-event";
import type { Course } from "../lib/db/types";

export interface CoursesState {
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  loading: boolean;
  reload: () => Promise<void>;
}

const CACHE_KEY = "courses";

function useCoursesData(): CoursesState {
  const [courses, setCourses] = useState<Course[]>(
    () => readCache<Course[]>(CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(
    () => readCache<Course[]>(CACHE_KEY) === null,
  );
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestRef.current;
    try {
      const rows = await fetchCourses();
      if (seq === requestRef.current) {
        setCourses(rows);
        writeCache(CACHE_KEY, rows);
      }
    } catch {
      // Keep whatever list is already on screen on a transient failure.
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { courses, setCourses, loading, reload };
}

/**
 * Course list for mounted screens. Refreshes on change only while the screen
 * is focused; hidden tabs do one refresh when they come back.
 */
export function useCourses(): CoursesState {
  const state = useCoursesData();
  const { reload } = state;
  useFocusedEvent(COURSES_CHANGED_EVENT, () => void reload());
  useFocusedEvent(FOCUS_CHANGED_EVENT, () => void reload());
  return state;
}

/**
 * Course list for providers that run outside a screen (the timer lives at the
 * root and must stay current even while the user is on another tab).
 */
export function useActiveCourses(): CoursesState {
  const state = useCoursesData();
  const { reload } = state;

  useEffect(() => {
    const refresh = () => void reload();
    const unwatchCourses = listen(COURSES_CHANGED_EVENT, refresh);
    const unwatchFocus = listen(FOCUS_CHANGED_EVENT, refresh);
    return () => {
      unwatchCourses();
      unwatchFocus();
    };
  }, [reload]);

  return state;
}
