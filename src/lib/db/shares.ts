import { supabase } from "../supabase";

export interface ShareResult {
  ok: boolean;
  message: string;
}

function toId(value: string): number | null {
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
