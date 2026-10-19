import { resolveSession } from "../auth";
import { sanitizeHtml } from "../notes";
import { supabase } from "../supabase";

export interface NoteShare {
  id: string;
  noteId: number | null;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  title: string;
  html: string;
  courseTitle: string | null;
  createdAt: number;
  readAt: number | null;
  importedAt: number | null;
}

export interface ShareResult {
  ok: boolean;
  message: string;
  shareId?: string;
}

export interface ImportResult {
  ok: boolean;
  message: string;
  noteId: string | null;
}

interface ShareRow {
  id: number;
  note_id: number | null;
  sender_id: string;
  title: string;
  content: string;
  course_title: string | null;
  created_at: string;
  read_at: string | null;
  imported_at: string | null;
}

interface SenderRow {
  id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
}

const SHARE_COLUMNS =
  "id, note_id, sender_id, title, content, course_title, created_at, read_at, imported_at";

function toId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function toMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toShare(row: ShareRow, sender: SenderRow | undefined): NoteShare {
  const name =
    sender?.display_name?.trim() || sender?.username?.trim() || "ATLAS user";
  return {
    id: String(row.id),
    noteId: typeof row.note_id === "number" ? row.note_id : null,
    senderId: row.sender_id,
    senderName: name,
    senderUsername: sender?.username ?? "",
    senderAvatarUrl: sender?.avatar_url ?? null,
    title: row.title,
    html: sanitizeHtml(row.content ?? ""),
    courseTitle: row.course_title,
    createdAt: toMs(row.created_at) ?? Date.now(),
    readAt: toMs(row.read_at),
    importedAt: toMs(row.imported_at),
  };
}

/** Sends a snapshot of one of my notes to an accepted friend. */
export async function shareNote(
  noteId: string,
  recipientId: string,
): Promise<ShareResult> {
  const parsed = toId(noteId);
  if (parsed === null) {
    return {
      ok: false,
      message: "Wait for this note to sync before sharing it.",
    };
  }
  if (!recipientId) {
    return { ok: false, message: "Pick a friend to share with." };
  }

  try {
    const { data, error } = await supabase.rpc("share_note", {
      p_note_id: parsed,
      p_recipient_id: recipientId,
    });
    if (error) return { ok: false, message: error.message };

    const payload = data as
      | { ok?: boolean; message?: string; share_id?: number }
      | null;
    if (!payload || typeof payload.ok !== "boolean") {
      return { ok: false, message: "The note could not be shared." };
    }
    return {
      ok: payload.ok,
      message: payload.message ?? (payload.ok ? "Note sent." : "Failed."),
      shareId:
        typeof payload.share_id === "number"
          ? String(payload.share_id)
          : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

export interface SharedInbox {
  ok: boolean;
  shares: NoteShare[];
}

/** Notes other people shared with me, newest first. */
export async function fetchSharedWithMe(): Promise<SharedInbox> {
  const me = await resolveSession();
  if (!me) return { ok: false, shares: [] };

  const { data, error } = await supabase
    .from("note_shares")
    .select(SHARE_COLUMNS)
    .eq("recipient_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !Array.isArray(data)) return { ok: false, shares: [] };

  const rows = data as unknown as ShareRow[];
  const senderIds = [...new Set(rows.map((row) => row.sender_id))];
  const senders = new Map<string, SenderRow>();

  if (senderIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", senderIds);
    if (Array.isArray(profileRows)) {
      for (const profile of profileRows as SenderRow[]) {
        senders.set(profile.id, profile);
      }
    }
  }

  return {
    ok: true,
    shares: rows.map((row) => toShare(row, senders.get(row.sender_id))),
  };
}

/** Marks a received share as opened (unread badge). */
export async function markShareRead(shareId: string): Promise<void> {
  const parsed = toId(shareId);
  if (parsed === null) return;
  await supabase.rpc("mark_note_share_read", { p_share_id: parsed });
}

/** Copies a shared note into my own notes (server-side snapshot copy). */
export async function importShare(shareId: string): Promise<ImportResult> {
  const parsed = toId(shareId);
  if (parsed === null) {
    return { ok: false, message: "That shared note could not be found.", noteId: null };
  }

  try {
    const { data, error } = await supabase.rpc("import_note_share", {
      p_share_id: parsed,
    });
    if (error) return { ok: false, message: error.message, noteId: null };

    const payload = data as
      | { ok?: boolean; message?: string; note_id?: number }
      | null;
    if (!payload || typeof payload.ok !== "boolean") {
      return {
        ok: false,
        message: "The note could not be imported.",
        noteId: null,
      };
    }
    return {
      ok: payload.ok,
      message: payload.message ?? (payload.ok ? "Note imported." : "Failed."),
      noteId:
        typeof payload.note_id === "number" ? String(payload.note_id) : null,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
      noteId: null,
    };
  }
}

/** Removes a received share (recipient side). */
export async function deleteShare(shareId: string): Promise<boolean> {
  const parsed = toId(shareId);
  if (parsed === null) return false;

  const me = await resolveSession();
  if (!me) return false;

  const { error } = await supabase
    .from("note_shares")
    .delete()
    .eq("id", parsed)
    .eq("recipient_id", me.id);
  return !error;
}
