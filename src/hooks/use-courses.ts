import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readCache, writeCache } from "../lib/data-cache";
import { fetchCourses } from "../lib/db/courses";
import { COURSES_CHANGED_EVENT, FOCUS_CHANGED_EVENT, listen } from "../lib/events";
import type { Course } from "../lib/db/types";

export interface CoursesState {
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  loading: boolean;
  reload: () => Promise<void>;
}

const CACHE_KEY = "courses";

/**
 * The shared course+topics list. Every mounted instance auto-reloads when a
 * course, topic or focus counter changes anywhere in the app. Seeded from the
 * in-memory cache so remounts paint instantly while fresh rows load.
 */
export function useCourses(): CoursesState {
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

  useEffect(() => {
    const refresh = () => void reload();
    const unwatchCourses = listen(COURSES_CHANGED_EVENT, refresh);
    const unwatchFocus = listen(FOCUS_CHANGED_EVENT, refresh);
    return () => {
      unwatchCourses();
      unwatchFocus();
    };
  }, [reload]);

  return { courses, setCourses, loading, reload };
}
