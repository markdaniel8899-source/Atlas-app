import {
  notifyCoursesChanged,
  notifyFriendsChanged,
  notifyLeaderboardChanged,
  notifyNotesChanged,
  notifyProfileChanged,
  notifyRoadmapsChanged,
} from "./events";
import {
  ensureNotificationPermission,
  sendInstantNotification,
} from "./notifications";
import { supabase } from "./supabase";

interface ChangePayload {
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

type Channel = ReturnType<typeof supabase.channel>;

let channel: Channel | null = null;
let activeUserId: string | null = null;
let generation = 0;
const names = new Map<string, string>();

async function senderName(id: unknown): Promise<string> {
  if (typeof id !== "string" || id.length === 0) return "A friend";
  const cached = names.get(id);
  if (cached) return cached;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", id)
      .maybeSingle();
    const row = data as { display_name?: string; username?: string } | null;
    const name =
      (row?.display_name ?? "").trim() ||
      (row?.username ?? "").trim() ||
      "A friend";
    names.set(id, name);
    return name;
  } catch {
    return "A friend";
  }
}

function changeOf(payload: unknown): ChangePayload {
  return (payload ?? {}) as ChangePayload;
}

function noteTitle(row: Record<string, unknown>): string {
  const title = typeof row.title === "string" ? row.title.trim() : "";
  return title.length > 0 ? title.slice(0, 60) : "Untitled note";
}

/**
 * Subscribes to every table this user owns (friendships, notes, profile,
 * courses, topics, sessions, roadmaps) once per signed-in session.
 *
 * Realtime is the single source of truth for live updates: screens listen to
 * the coalesced app events instead of polling, so nothing needs a manual
 * refresh. Incoming friend requests and freshly shared notes additionally
 * raise an instant local notification.
 */
export function startRealtime(userId: string): void {
  if (channel && activeUserId === userId) return;
  stopRealtime();

  activeUserId = userId;
  const gen = (generation += 1);
  const uid = userId;
  names.clear();
  void ensureNotificationPermission();

  const mine = `user_id=eq.${uid}`;

  const next = supabase
    .channel(`atlas-live-${uid}`)
    // Incoming requests (addressee) and sent requests / accepts (requester).
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
        filter: `addressee_id=eq.${uid}`,
      },
      (payload) => {
        notifyFriendsChanged();
        const change = changeOf(payload);
        if (change.eventType !== "INSERT") return;
        const row = change.new ?? {};
        if (row.addressee_id !== uid) return;
        if (row.status !== "pending") return;
        void (async () => {
          const name = await senderName(row.requester_id);
          if (gen !== generation) return;
          void sendInstantNotification(
            "New friend request",
            `${name} wants to be friends on ATLAS.`,
          );
        })();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
        filter: `requester_id=eq.${uid}`,
      },
      () => notifyFriendsChanged(),
    )
    // Notes owned by this user (own edits + copies shared by friends).
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes", filter: mine },
      (payload) => {
        notifyNotesChanged();
        const change = changeOf(payload);
        if (change.eventType !== "INSERT") return;
        const row = change.new ?? {};
        const sharedBy = row.shared_by;
        if (typeof sharedBy !== "string" || sharedBy === uid) return;
        void (async () => {
          const name = await senderName(sharedBy);
          if (gen !== generation) return;
          void sendInstantNotification(
            "Note shared with you",
            `${name} shared "${noteTitle(row)}" with you.`,
          );
        })();
      },
    )
    // Own profile from another device.
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
      () => notifyProfileChanged(),
    )
    // Any visible profile change keeps the live leaderboard current.
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => notifyLeaderboardChanged(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "courses", filter: mine },
      () => notifyCoursesChanged(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "course_topics", filter: mine },
      () => notifyCoursesChanged(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "learning_sessions",
        filter: mine,
      },
      () => {
        notifyProfileChanged();
        notifyLeaderboardChanged();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "roadmaps", filter: mine },
      () => notifyRoadmapsChanged(),
    );

  next.subscribe();
  channel = next;
}

/** Tears the socket down on sign-out / account switch. */
export function stopRealtime(): void {
  generation += 1;
  activeUserId = null;
  names.clear();
  const current = channel;
  channel = null;
  if (current) void supabase.removeChannel(current);
}
