import { supabase } from '@/lib/supabase';

import type { InviteResult, Relationship, SquadMember, SquadStatus } from './types';

interface FriendshipRow {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
}

interface ProfileRow {
  id: string;
  display_name: string;
  username: string;
  streak: number;
  xp: number;
  level: number;
  last_active_date: string | null;
  avatar_url: string | null;
}

const PROFILE_COLUMNS =
  'id, display_name, username, streak, xp, level, last_active_date, avatar_url';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function daysAgo(date: string | null): number | null {
  if (!date) return null;
  const parsed = Date.parse(`${date}T00:00:00`);
  if (Number.isNaN(parsed)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - parsed) / 86_400_000);
}

function statusFrom(
  lastActive: string | null,
): { status: SquadStatus; label: string } {
  const gap = daysAgo(lastActive);
  if (gap !== null && gap <= 0) {
    return { status: 'studying', label: 'Active today' };
  }
  if (gap !== null && gap === 1) {
    return { status: 'online', label: 'Active yesterday' };
  }
  return { status: 'offline', label: 'Offline' };
}

export async function fetchSquad(userId: string | null): Promise<SquadMember[]> {
  if (!supabase || !userId) return [];

  const { data: linkRows, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .in('status', ['pending', 'accepted']);

  if (error || !Array.isArray(linkRows) || linkRows.length === 0) return [];

  const links = linkRows as unknown as FriendshipRow[];
  const peerIds = Array.from(
    new Set(
      links.map((link) =>
        link.requester_id === userId ? link.addressee_id : link.requester_id,
      ),
    ),
  );

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('id', peerIds);

  if (profileError || !Array.isArray(profileRows)) return [];

  const byId = new Map<string, ProfileRow>();
  for (const row of profileRows as unknown as ProfileRow[]) {
    byId.set(row.id, row);
  }

  const members: SquadMember[] = [];

  for (const link of links) {
    const peerId =
      link.requester_id === userId ? link.addressee_id : link.requester_id;
    const profile = byId.get(peerId);
    if (!profile) continue;

    const displayName = profile.display_name.trim() || profile.username;
    const { status, label } = statusFrom(profile.last_active_date);
    const relationship: Relationship =
      link.status === 'accepted'
        ? 'friend'
        : link.requester_id === userId
          ? 'outgoing'
          : 'incoming';

    members.push({
      friendshipId: link.id,
      id: profile.id,
      displayName,
      username: profile.username,
      initials: initialsOf(displayName),
      status,
      statusLabel: label,
      streak: profile.streak,
      level: profile.level,
      xp: profile.xp,
      avatarUrl: profile.avatar_url,
      relationship,
    });
  }

  return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function acceptInvite(friendshipId: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  return !error;
}

export async function declineInvite(friendshipId: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  return !error;
}

export async function inviteFriend(email: string): Promise<InviteResult> {
  if (!supabase) {
    return { ok: false, message: 'Sign-in is unavailable right now.' };
  }
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, message: "That email doesn't look right." };
  }

  try {
    const { data, error } = await supabase.rpc('invite_friend', {
      p_email: trimmed,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const payload = data as InviteResult | null;
    if (!payload || typeof payload.ok !== 'boolean') {
      return { ok: false, message: 'Invite could not be sent.' };
    }
    return payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error.';
    return { ok: false, message };
  }
}
