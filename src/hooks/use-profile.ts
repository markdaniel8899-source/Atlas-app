import { useEffect, useState } from "react";
import { resolveSession } from "../lib/auth";
import { fetchProfile } from "../lib/db/profile";
import { PROFILE_CHANGED_EVENT, listen } from "../lib/events";
import {
  PROFILE_CACHE_FRESH_MS,
  getCachedProfile,
  hydrateProfileCache,
  profileCacheAgeMs,
} from "../lib/profile-cache";
import type { Profile } from "../lib/db/types";

/**
 * Cache-first profile for chrome (header avatar, account sheet...). The first
 * render already has the last known profile, so switching tabs never flashes
 * a fallback; fresh data replaces it in the background without blocking.
 */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(() =>
    getCachedProfile(),
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      const user = await resolveSession();
      if (!active || !user) return;
      const cached = getCachedProfile(user.id);
      if (cached) setProfile(cached);
      if (cached && profileCacheAgeMs() < PROFILE_CACHE_FRESH_MS) return;
      const row = await fetchProfile(user.id).catch(() => null);
      if (active && row) setProfile(row);
    };

    void (async () => {
      await hydrateProfileCache();
      if (!active) return;
      // Show the persisted snapshot only when it belongs to the current
      // session, then revalidate if it is stale.
      const user = await resolveSession();
      if (!active || !user) return;
      const cached = getCachedProfile(user.id);
      if (cached) setProfile(cached);
      await load();
    })();

    const unsubscribe = listen(PROFILE_CHANGED_EVENT, () => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return profile;
}
