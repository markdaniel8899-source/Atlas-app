import { useCallback, useEffect, useState } from "react";
import { resolveSession } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { fetchHeatmap } from "../lib/db/activity";
import { fetchFocusCourse } from "../lib/db/courses";
import {
  COURSES_CHANGED_EVENT,
  FOCUS_CHANGED_EVENT,
  PROFILE_CHANGED_EVENT,
  listen,
} from "../lib/events";
import { fetchProfile } from "../lib/db/profile";
import type { FocusCourse, HeatmapDay, Profile } from "../lib/db/types";

export interface DashboardData {
  user: AuthUser | null;
  profile: Profile | null;
  heatmap: HeatmapDay[];
  focus: FocusCourse | null;
}

export interface DashboardState extends DashboardData {
  loading: boolean;
  reload: () => void;
}

const EMPTY: DashboardData = {
  user: null,
  profile: null,
  heatmap: [],
  focus: null,
};

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    void (async () => {
      const user = await resolveSession();
      if (!user) {
        setData(EMPTY);
        setLoading(false);
        return;
      }

      try {
        const [profile, heatmap, focus] = await Promise.all([
          fetchProfile(user.id),
          fetchHeatmap(365),
          fetchFocusCourse(),
        ]);
        setData({ user, profile, heatmap, focus });
      } catch {
        setData({ ...EMPTY, user });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Re-read profile / focus course / heatmap whenever a session, course,
  // topic or XP change happens anywhere in the app.
  useEffect(() => {
    const refresh = () => reload();
    const a = listen(PROFILE_CHANGED_EVENT, refresh);
    const b = listen(COURSES_CHANGED_EVENT, refresh);
    const c = listen(FOCUS_CHANGED_EVENT, refresh);
    return () => {
      a();
      b();
      c();
    };
  }, [reload]);

  return { ...data, loading, reload };
}
