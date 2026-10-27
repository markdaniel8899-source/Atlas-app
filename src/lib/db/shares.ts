import { resolveSession } from "../auth";
import { supabase } from "../supabase";

export interface ShareResult {
  ok: boolean;
  message: string;
}

export interface BulkShareResult {
  ok: boolean;
  message: string;
  sharedCount: number;
  failedCount: number;
}

/** Positive safe-integer id (numeric bigint once the note is persisted). */
export function toShareableId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Copies one of my notes into an accepted friend's Notes (server-side RPC).
 * The recipient can then edit or delete their own copy like any other note.
 * Handles RATE_LIMIT error from the RPC (max 10 shares/day per sender→recipient).
 */
export async function shareNote(
  noteId: string,
  recipientId: string,
): Promise<ShareResult> {
  const parsed = toShareableId(noteId);
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
    if (error) {
      // Handle RATE_LIMIT from the updated share_note RPC
      if (error.message === "RATE_LIMIT") {
        return {
          ok: false,
          message:
            "You've shared a lot of notes with this friend today. Try again tomorrow.",
        };
      }
      return { ok: false, message: error.message };
    }

    const payload = data as
      | { ok?: boolean; message?: string }
      | null;
    if (!payload || typeof payload.ok !== "boolean") {
      return { ok: false, message: "The note could not be shared." };
    }
    return {
      ok: payload.ok,
      message: payload.message ?? (payload.ok ? "Note sent." : "Failed."),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Share several notes with several accepted friends. Each note is copied
 * into each recipient's Notes (same server-side `share_note` RPC as the
 * single-note flow). Returns per-pair success counts so the UI can report
 * partial failures instead of hiding them.
 */
export async function bulkShareNotes(
  noteIds: string[],
  recipientIds: string[],
): Promise<BulkShareResult> {
  const user = await resolveSession();
  if (!user) {
    return {
      ok: false,
      message: "You are not signed in.",
      sharedCount: 0,
      failedCount: noteIds.length * recipientIds.length,
    };
  }

  const validNoteIds = noteIds
    .map(toShareableId)
    .filter((id): id is number => id !== null);
  const recipients = [...new Set(recipientIds.filter(Boolean))];

  if (validNoteIds.length === 0 || recipients.length === 0) {
    return {
      ok: false,
      message: "No valid notes or friends selected.",
      sharedCount: 0,
      failedCount: 0,
    };
  }

  let sharedCount = 0;
  let failedCount = 0;
  let lastError = "";

  for (const noteId of validNoteIds) {
    for (const recipientId of recipients) {
      try {
        const { data, error } = await supabase.rpc("share_note", {
          p_note_id: noteId,
          p_recipient_id: recipientId,
        });
        if (error) {
          failedCount += 1;
          lastError =
            error.message === "RATE_LIMIT"
              ? "Daily share limit reached for one friend."
              : error.message;
          continue;
        }
        const payload = data as { ok?: boolean; message?: string } | null;
        if (!payload || payload.ok !== true) {
          failedCount += 1;
          if (payload?.message) lastError = payload.message;
          continue;
        }
        sharedCount += 1;
      } catch (err) {
        failedCount += 1;
        lastError = err instanceof Error ? err.message : "Network error.";
      }
    }
  }

  const total = validNoteIds.length * recipients.length;
  if (sharedCount === 0) {
    return {
      ok: false,
      message: lastError || "The notes could not be shared.",
      sharedCount,
      failedCount,
    };
  }

  return {
    ok: true,
    message:
      failedCount > 0
        ? `Shared ${sharedCount} of ${total}. ${failedCount} failed${
            lastError ? ` (${lastError})` : ""
          }.`
        : `Shared ${sharedCount} note${sharedCount > 1 ? "s" : ""}.`,
    sharedCount,
    failedCount,
  };
}
