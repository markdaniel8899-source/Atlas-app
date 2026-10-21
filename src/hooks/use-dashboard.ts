import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedAuthUser, resolveSession } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { readCache, writeCache } from "../lib/data-cache";
import { fetchHeatmap } from "../lib/db/activity";
import { fetchFocusCourse } from "../lib/db/courses";
import {
  COURSES_CHANGED_EVENT,
  FOCUS_CHANGED_EVENT,
  PROFILE_CHANGED_EVENT,
} from "../lib/events";
import { useFocusedEvent } from "./use-focused-event";
import { fetchProfile } from "../lib/db/profile";
import { getCachedProfile } from "../lib/profile-cache";
import { syncStreakReminder } from "../lib/notifications";
import { syncAtlasStatsWidget } from "../lib/widgets/widget-sync";
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
    // The warmed session (module scope in the root layout) is the correct
    // synchronous answer; seeding null here made the redirect gate race the
    // async session read on remounts.
    user: getCachedAuthUser(),
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

  const requestRef = useRef(0);

  const reload = useCallback(() => {
    const request = ++requestRef.current;
    void (async () => {
      const user = await resolveSession().catch(() => getCachedAuthUser());
      if (request !== requestRef.current) return;
      if (!user) {
        setData(EMPTY);
        syncAtlasStatsWidget(null, []);
        void syncStreakReminder(null);
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
        // A late response for the previous account must not repaint or
        // re-cache data after the owner has changed.
        if (request !== requestRef.current) return;
        if (getCachedAuthUser()?.id !== user.id) return;
        writeCache<DashboardSnapshot>(CACHE_KEY, { heatmap, focus });
        const next: DashboardData = {
          user,
          profile: profile ?? cachedProfile,
          heatmap,
          focus,
        };
        setData(next);
        syncAtlasStatsWidget(next.profile, heatmap);
        void syncStreakReminder(
          next.profile
            ? {
                streak: next.profile.streak ?? 0,
                lastActiveDate: next.profile.last_active_date ?? null,
              }
            : null,
        );
      } catch {
        if (request !== requestRef.current) return;
        if (getCachedAuthUser()?.id !== user.id) return;
        if (!cachedProfile) setData((prev) => ({ ...prev, user }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Re-read profile / focus course / heatmap when this screen is visible and
  // something changed. Hidden tabs keep one pending refresh for their focus.
  useFocusedEvent(PROFILE_CHANGED_EVENT, reload);
  useFocusedEvent(COURSES_CHANGED_EVENT, reload);
  useFocusedEvent(FOCUS_CHANGED_EVENT, reload);

  return { ...data, loading, reload };
}
