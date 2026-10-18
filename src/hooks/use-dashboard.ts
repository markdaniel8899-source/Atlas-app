import { useCallback, useEffect, useState } from "react";
import { resolveSession } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { readCache, writeCache } from "../lib/data-cache";
import { fetchHeatmap } from "../lib/db/activity";
import { fetchFocusCourse } from "../lib/db/courses";
import {
  COURSES_CHANGED_EVENT,
  FOCUS_CHANGED_EVENT,
  PROFILE_CHANGED_EVENT,
  listen,
} from "../lib/events";
import { fetchProfile } from "../lib/db/profile";
import { getCachedProfile } from "../lib/profile-cache";
import { syncAtlasWidget } from "../lib/widgets/widget-sync";
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

interface DashboardSnapshot {
  heatmap: HeatmapDay[];
  focus: FocusCourse | null;
}

const CACHE_KEY = "dashboard.home";

const EMPTY: DashboardData = {
  user: null,
  profile: null,
  heatmap: [],
  focus: null,
};

/** Last rendered dashboard payload - paints instantly on remount. */
function seed(): DashboardData {
  const snapshot = readCache<DashboardSnapshot>(CACHE_KEY);
  return {
    user: null,
    profile: getCachedProfile(),
    heatmap: snapshot?.heatmap ?? [],
    focus: snapshot?.focus ?? null,
  };
}

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardData>(seed);
  const [loading, setLoading] = useState(
    () => readCache<DashboardSnapshot>(CACHE_KEY) === null,
  );

  const reload = useCallback(() => {
    void (async () => {
      const user = await resolveSession();
      if (!user) {
        setData(EMPTY);
        syncAtlasWidget(null);
        setLoading(false);
        return;
      }

      const cachedProfile = getCachedProfile(user.id);
      if (cachedProfile) {
        setData((prev) => ({ ...prev, user, profile: cachedProfile }));
      }

      try {
        const [profile, heatmap, focus] = await Promise.all([
          fetchProfile(user.id),
          fetchHeatmap(365),
          fetchFocusCourse(),
        ]);
        writeCache<DashboardSnapshot>(CACHE_KEY, { heatmap, focus });
        const next: DashboardData = {
          user,
          profile: profile ?? cachedProfile,
          heatmap,
          focus,
        };
        setData(next);
        syncAtlasWidget(next.profile);
      } catch {
        if (!cachedProfile) setData((prev) => ({ ...prev, user }));
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
