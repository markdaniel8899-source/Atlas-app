import { resolveSession } from "../auth";
import { getRankFromXP } from "../gamification";
import { supabase } from "../supabase";

export type SquadStatus = "studying" | "online" | "offline";
export type Relationship = "friend" | "outgoing" | "incoming";

export interface SquadMember {
  friendshipId: number;
  id: string;
  displayName: string;
  username: string;
  initials: string;
  /** Avatar gradient pair [from, to] when no uploaded avatar exists. */
  avatar: [string, string];
  status: SquadStatus;
  statusLabel: string;
  streak: number;
  level: number;
  xp: number;
  progressPercent: number;
  avatarUrl: string | null;
  relationship: Relationship;
}

interface FriendshipRow {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
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

export interface InviteResult {
  ok: boolean;
  message: string;
}

const AVATARS: [string, string][] = [
  ["#3d4f9e", "#7b8ee8"],
  ["#2f6f6a", "#5fbdb2"],
  ["#6b3fa0", "#a982e0"],
  ["#a0593f", "#e0975f"],
  ["#28617e", "#5aa7cd"],
  ["#7e3f5c", "#cd6f95"],
];

const PROFILE_COLUMNS =
  "id, display_name, username, streak, xp, level, last_active_date, avatar_url";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function daysAgo(date: string | null): number | null {
  if (!date) return null;
  const parsed = Date.parse(`${date}T00:00:00`);
  if (Number.isNaN(parsed)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - parsed) / 86_400_000);
}

function statusFrom(lastActive: string | null): {
  status: SquadStatus;
  label: string;
} {
  const gap = daysAgo(lastActive);
  if (gap !== null && gap <= 0) {
    return { status: "studying", label: "Active today" };
  }
  if (gap !== null && gap === 1) {
    return { status: "online", label: "Active yesterday" };
  }
  return { status: "offline", label: "Offline" };
}

export async function fetchSquad(): Promise<SquadMember[]> {
  const me = await resolveSession();
  if (!me) return [];

  const { data: linkRows, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
    .in("status", ["pending", "accepted"]);

  if (error || !Array.isArray(linkRows) || linkRows.length === 0) return [];

  const links = linkRows as unknown as FriendshipRow[];
  const peerIds = Array.from(
    new Set(
      links.map((link) =>
        link.requester_id === me.id ? link.addressee_id : link.requester_id,
      ),
    ),
  );

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", peerIds);

  if (profileError || !Array.isArray(profileRows)) return [];

  const byId = new Map<string, ProfileRow>();
  for (const row of profileRows as unknown as ProfileRow[]) {
    byId.set(row.id, row);
  }

  const members: SquadMember[] = [];

  for (const link of links) {
    const peerId =
      link.requester_id === me.id ? link.addressee_id : link.requester_id;
    const profile = byId.get(peerId);
    if (!profile) continue;

    const displayName = profile.display_name.trim() || profile.username;
    const { status, label } = statusFrom(profile.last_active_date);
    const rankData = getRankFromXP(profile.xp);
    const relationship: Relationship =
      link.status === "accepted"
        ? "friend"
        : link.requester_id === me.id
          ? "outgoing"
          : "incoming";

    members.push({
      friendshipId: link.id,
      id: profile.id,
      displayName,
      username: profile.username,
      initials: initialsOf(displayName),
      avatar: AVATARS[hashOf(profile.id) % AVATARS.length],
      status,
      statusLabel: label,
      streak: profile.streak,
      level: profile.level,
      xp: profile.xp,
      progressPercent: Math.round(rankData.percent),
      avatarUrl: profile.avatar_url,
      relationship,
    });
  }

  return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function acceptInvite(friendshipId: number): Promise<void> {
  await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);
}

export async function declineInvite(friendshipId: number): Promise<void> {
  await supabase.from("friendships").delete().eq("id", friendshipId);
}

export async function inviteFriend(email: string): Promise<InviteResult> {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, message: "That email doesn't look right." };
  }

  try {
    const { data, error } = await supabase.rpc("invite_friend", {
      p_email: trimmed,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const payload = data as InviteResult | null;
    if (!payload || typeof payload.ok !== "boolean") {
      return { ok: false, message: "Invite could not be sent." };
    }
    return payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error.";
    return { ok: false, message };
  }
}
