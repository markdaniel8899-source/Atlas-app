import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedAuthUser, resolveSession } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { getAuthSnapshot } from "../lib/auth-snapshot";
import { readCache, writeCache } from "../lib/data-cache";
import { readDashboardCache, writeDashboardCache } from "../lib/dashboard-cache";
import { fetchHeatmap } from "../lib/db/activity";
import { fetchFocusCourse } from "../lib/db/courses";
import {
  COURSES_CHANGED_EVENT,
  FOCUS_CHANGED_EVENT,
  PROFILE_CHANGED_EVENT,
} from "../lib/events";
import { useFocusedEvent } from "./use-focused-event";
import { fetchProfile } from "../lib/db/profile";
import {
  getCachedProfile,
  hydrateProfileCache,
} from "../lib/profile-cache";
import { syncStreakReminder } from "../lib/notifications";
import { diag } from "../lib/diagnostics";
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
  stale: boolean;
  reload: () => Promise<void>;
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
    // synchronous answer; the persisted snapshot covers an offline start
    // where the token refresh cannot complete.
    user: getCachedAuthUser() ?? getAuthSnapshot(),
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
  const [stale, setStale] = useState(false);

  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    let user: AuthUser | null = null;
    let cachedProfile: Profile | null = null;
    diag("dash:reload", { request });
    try {
      user = await resolveSession().catch(() => getCachedAuthUser());
      if (request !== requestRef.current) return;
      if (!user) {
        diag("dash:signed-out");
        setData(EMPTY);
        syncAtlasStatsWidget(null, []);
        void syncStreakReminder(null);
        setLoading(false);
        setStale(false);
        return;
      }

      // The root layout usually warmed this already; awaiting the shared read
      // keeps a direct call safe too (the header must never flash a fallback
      // because hydration had not finished yet).
      await hydrateProfileCache();
      cachedProfile = getCachedProfile(user.id);
      if (cachedProfile) {
        diag("dash:cached-profile");
        setData((prev) => ({ ...prev, user, profile: cachedProfile }));
      }

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
      if (user) {
        void writeDashboardCache(user.id, { heatmap, focus });
      }
      const next: DashboardData = {
        user,
        profile: profile ?? cachedProfile,
        heatmap,
        focus,
      };
      setData(next);
      diag("dash:data", {
        profile: Boolean(next.profile),
        heatmap: heatmap.length,
      });
      diag("dash:widget:start");
      syncAtlasStatsWidget(next.profile, heatmap);
      diag("dash:widget:done");
      void syncStreakReminder(
        next.profile
          ? {
              streak: next.profile.streak ?? 0,
              lastActiveDate: next.profile.last_active_date ?? null,
            }
          : null,
      );
      setStale(false);
    } catch (error) {
      diag("dash:error", {
        message: error instanceof Error ? error.message : String(error),
      });
      if (request !== requestRef.current) return;
      if (getCachedAuthUser()?.id !== user?.id) return;
      if (!cachedProfile && user) setData((prev) => ({ ...prev, user }));
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Hydrate last-session dashboard state from disk so a cold offline start
  // paints heatmap / focus immediately instead of an empty screen. Revalidates
  // against the server via reload() on mount.
  useEffect(() => {
    let alive = true;
    const user = getCachedAuthUser() ?? getAuthSnapshot();
    if (!user) return;
    void (async () => {
      const persisted = await readDashboardCache(user.id);
      if (!alive) return;
      if (getCachedAuthUser()?.id !== user.id) return;
      if (persisted) {
        diag("dash:cache-hydrate");
        // Seed the shared memory cache too, otherwise other screens and the
        // widget still see an empty dashboard after an offline restart.
        writeCache<DashboardSnapshot>(CACHE_KEY, persisted);
        const profile = getCachedProfile(user.id);
        setData((prev) => ({
          ...prev,
          profile: prev.profile ?? profile,
          heatmap: persisted.heatmap ?? prev.heatmap,
          focus: persisted.focus ?? prev.focus,
        }));
        setLoading(false);
        syncAtlasStatsWidget(profile, persisted.heatmap ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Re-read profile / focus course / heatmap when this screen is visible and
  // something changed. Hidden tabs keep one pending refresh for their focus.
  useFocusedEvent(PROFILE_CHANGED_EVENT, reload);
  useFocusedEvent(COURSES_CHANGED_EVENT, reload);
  useFocusedEvent(FOCUS_CHANGED_EVENT, reload);

  return { ...data, loading, stale, reload };
}
