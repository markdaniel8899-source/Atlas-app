import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { fetchCourses } from "../lib/db/courses";
import { COURSES_CHANGED_EVENT, FOCUS_CHANGED_EVENT, listen } from "../lib/events";
import type { Course } from "../lib/db/types";

export interface CoursesState {
  courses: Course[];
  setCourses: Dispatch<SetStateAction<Course[]>>;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * The shared course+topics list. Every mounted instance auto-reloads when a
 * course, topic or focus counter changes anywhere in the app.
 */
export function useCourses(): CoursesState {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchCourses();
      setCourses(rows);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
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
