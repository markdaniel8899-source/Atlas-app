import { useCallback, useEffect, useState } from 'react';

import { fetchHeatmap } from '@/lib/db/activity';
import { fetchFocusCourse } from '@/lib/db/courses';
import {
  COURSES_CHANGED_EVENT,
  FOCUS_CHANGED_EVENT,
  PROFILE_CHANGED_EVENT,
  subscribe,
} from '@/lib/db/events';
import { fetchProfile } from '@/lib/db/profile';
import type { FocusCourse, HeatmapDay, Profile } from '@/lib/db/types';

export interface DashboardState {
  profile: Profile | null;
  heatmap: HeatmapDay[];
  focus: FocusCourse | null;
  loading: boolean;
  reload: () => void;
}

interface DashboardData {
  profile: Profile | null;
  heatmap: HeatmapDay[];
  focus: FocusCourse | null;
}

export function useDashboard(userId: string | null): DashboardState {
  const [data, setData] = useState<DashboardData | null>(null);

  const reload = useCallback(() => {
    if (!userId) return;
    void Promise.all([fetchProfile(userId), fetchHeatmap(365), fetchFocusCourse(userId)])
      .then(([profile, heatmap, focus]) => {
        setData({ profile, heatmap, focus });
      })
      .catch(() => {
        setData({ profile: null, heatmap: [], focus: null });
      });
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => reload();
    const unsubs = [
      subscribe(PROFILE_CHANGED_EVENT, refresh),
      subscribe(COURSES_CHANGED_EVENT, refresh),
      subscribe(FOCUS_CHANGED_EVENT, refresh),
    ];
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [reload, userId]);

  return {
    profile: data?.profile ?? null,
    heatmap: data?.heatmap ?? [],
    focus: data?.focus ?? null,
    loading: userId != null && data === null,
    reload,
  };
}
