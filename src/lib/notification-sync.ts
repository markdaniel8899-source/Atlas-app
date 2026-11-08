/**
 * Rebuilds the in-app notification centre from the database. Realtime events
 * push items instantly; this sync catches anything that happened while the
 * app was closed or the socket was down (and fills the drawer badges).
 */
import { getCachedAuthUser, resolveSession } from "./auth";
import {
  pushNotification,
  setFriendRequestCount,
} from "./notification-center";
import { supabase } from "./supabase";

const RECENT_WINDOW_MS = 14 * 86_400_000;
const SYNC_THROTTLE_MS = 5_000;

interface IncomingFriendRequest {
  friendshipId: number;
  requesterId: string;
  createdAt: string | null;
}

interface AcceptedInvite {
  friendshipId: number;
  peerId: string;
  updatedAt: string | null;
}

interface SharedNote {
  id: number;
  title: string;
  sharedBy: string;
  sharedAt: string | null;
}

interface FetchResult<T> {
  /** False when the request failed (offline / server error). */
  ok: boolean;
  rows: T[];
}

let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

function timeOf(iso: string | null): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function fetchIncomingFriendRequests(
  userId: string,
): Promise<FetchResult<IncomingFriendRequest>> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, created_at")
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data)) return { ok: false, rows: [] };
  const rows: IncomingFriendRequest[] = [];
  for (const row of data as unknown as {
    id: number;
    requester_id: string | null;
    created_at: string | null;
  }[]) {
    if (typeof row.requester_id !== "string") continue;
    rows.push({
      friendshipId: row.id,
      requesterId: row.requester_id,
      createdAt: row.created_at,
    });
  }
  return { ok: true, rows };
}

async function fetchAcceptedInvites(
  userId: string,
): Promise<FetchResult<AcceptedInvite>> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, addressee_id, updated_at")
    .eq("requester_id", userId)
    .eq("status", "accepted")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error || !Array.isArray(data)) return { ok: false, rows: [] };
  const rows: AcceptedInvite[] = [];
  for (const row of data as unknown as {
    id: number;
    addressee_id: string | null;
    updated_at: string | null;
  }[]) {
    if (typeof row.addressee_id !== "string") continue;
    rows.push({
      friendshipId: row.id,
      peerId: row.addressee_id,
      updatedAt: row.updated_at,
    });
  }
  return { ok: true, rows };
}

async function fetchSharedNotes(
  userId: string,
): Promise<FetchResult<SharedNote>> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, shared_by, shared_at")
    .eq("user_id", userId)
    .not("shared_by", "is", null)
    .gte("shared_at", since)
    .order("shared_at", { ascending: false })
    .limit(8);

  if (error || !Array.isArray(data)) return { ok: false, rows: [] };
  const rows: SharedNote[] = [];
  for (const row of data as unknown as {
    id: number;
    title: string | null;
    shared_by: string | null;
    shared_at: string | null;
  }[]) {
    if (typeof row.shared_by !== "string") continue;
    rows.push({
      id: row.id,
      title: row.title ?? "",
      sharedBy: row.shared_by,
      sharedAt: row.shared_at,
    });
  }
  return { ok: true, rows };
}

async function fetchDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", unique);

  if (error || !Array.isArray(data)) return names;
  for (const row of data as unknown as {
    id: string;
    display_name: string | null;
    username: string | null;
  }[]) {
    const name = (row.display_name ?? "").trim() || (row.username ?? "").trim();
    if (name) names.set(row.id, name);
  }
  return names;
}

function nameOf(names: Map<string, string>, id: string): string {
  return names.get(id) ?? "A friend";
}

async function runSync(): Promise<void> {
  const me = await resolveSession();
  if (!me) return;

  const [requests, accepted, shared] = await Promise.all([
    fetchIncomingFriendRequests(me.id),
    fetchAcceptedInvites(me.id),
    fetchSharedNotes(me.id),
  ]);

  // The account may have changed while the queries were in flight.
  if (getCachedAuthUser()?.id !== me.id) return;

  if (requests.ok) setFriendRequestCount(requests.rows.length);

  const ids = [
    ...requests.rows.map((row) => row.requesterId),
    ...accepted.rows.map((row) => row.peerId),
    ...shared.rows.map((row) => row.sharedBy),
  ];
  const names = await fetchDisplayNames(ids);
  if (getCachedAuthUser()?.id !== me.id) return;

  for (const request of requests.rows) {
    pushNotification({
      id: `friend-request:${request.friendshipId}`,
      kind: "friend_request",
      message: `${nameOf(names, request.requesterId)} sent you a friend request`,
      detail: "Open Friends to accept or decline.",
      href: "/friends",
      createdAt: timeOf(request.createdAt),
    });
  }

  for (const invite of accepted.rows) {
    pushNotification({
      id: `friend-accepted:${invite.friendshipId}`,
      kind: "friend_accepted",
      message: `${nameOf(names, invite.peerId)} accepted your friend request`,
      detail: "They are now in your Friends list.",
      href: "/friends",
      createdAt: timeOf(invite.updatedAt),
    });
  }

  for (const note of shared.rows) {
    pushNotification({
      id: `note-shared:${note.id}`,
      kind: "note_shared",
      message: `${nameOf(names, note.sharedBy)} shared a note with you`,
      detail: note.title.trim() || "Untitled note",
      href: "/notes",
      createdAt: timeOf(note.sharedAt),
    });
  }
}

/**
 * Refreshes the notification list. Throttled by default so realtime bursts and
 * screen mounts do not hammer the database; pass `force` when the bell opens.
 */
export function syncAllNotifications(options: {
  force?: boolean;
} = {}): Promise<void> {
  if (inFlight) return inFlight;
  if (!options.force && Date.now() - lastSyncAt < SYNC_THROTTLE_MS) {
    return Promise.resolve();
  }
  lastSyncAt = Date.now();
  inFlight = runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
