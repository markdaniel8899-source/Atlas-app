import { supabase } from '@/lib/supabase';

import { notifyProfileChanged } from './events';
import type { Profile } from './types';

const PROFILE_COLUMNS =
  'id, username, display_name, streak, xp, level, avatar_url, last_active_date, weekly_xp, total_xp, day_streak, total_focus_seconds';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function getGlobalFocusSeconds(userId: string | null): Promise<number> {
  if (!supabase || !userId) return 0;

  const { data, error } = await supabase
    .from('profiles')
    .select('total_focus_seconds')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return 0;
  const value = Number((data as { total_focus_seconds?: unknown }).total_focus_seconds);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function addGlobalFocusSeconds(userId: string | null, seconds: number): Promise<boolean> {
  if (!supabase || !userId) return false;
  if (!Number.isFinite(seconds) || seconds < 1) return false;

  const current = await getGlobalFocusSeconds(userId);
  const { error } = await supabase
    .from('profiles')
    .update({ total_focus_seconds: current + Math.floor(seconds) })
    .eq('id', userId);

  return !error;
}

export interface ProfilePatch {
  display_name?: string;
  username?: string;
  avatar_url?: string | null;
}

export async function updateProfile(
  userId: string | null,
  patch: ProfilePatch,
): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase || !userId) {
    return { profile: null, error: 'Sign-in is unavailable right now.' };
  }

  const values: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    values.display_name = patch.display_name.trim().slice(0, 60);
  }
  if (patch.username !== undefined) {
    values.username = patch.username.trim().toLowerCase().slice(0, 24);
  }
  if (patch.avatar_url !== undefined) {
    values.avatar_url = patch.avatar_url;
  }
  if (Object.keys(values).length === 0) {
    const current = await fetchProfile(userId);
    return { profile: current, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    const message =
      error.code === '23505'
        ? 'That username is already taken.'
        : "Couldn't save your profile. Check your connection.";
    return { profile: null, error: message };
  }
  if (!data) {
    return { profile: null, error: "Couldn't save your profile." };
  }

  notifyProfileChanged();
  return { profile: data as Profile, error: null };
}
