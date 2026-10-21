import { notifyProfileChanged } from "../events";
import { supabase } from "../supabase";

export interface QuizSessionInput {
  topic: string;
  kind?: string;
  correct: number;
  total: number;
  xp: number;
}

export interface QuizSessionSaveResult {
  /** Achievement codes unlocked by this run. */
  codes: string[];
  /** False when the full session log could not be written (offline etc.). */
  recorded: boolean;
  /** True when XP/streak was accepted by the fallback RPC. */
  xpRecorded: boolean;
  /** True when the session was recorded or XP was awarded. */
  ok: boolean;
}

/**
 * Persists a finished quiz (feeds the achievement engine), awards XP and
 * refreshes the streak via the `record_quiz_session` RPC. Returns the codes
 * of any achievements unlocked by this run, and whether the session log was
 * actually recorded.
 */
export async function saveQuizSession(
  input: QuizSessionInput,
): Promise<QuizSessionSaveResult> {
  const payload = {
    p_topic: input.topic.slice(0, 160),
    p_kind: input.kind ?? "mixed",
    p_correct: Math.max(0, input.correct),
    p_total: Math.max(0, input.total),
    p_xp: Math.max(0, input.xp),
  };

  try {
    const { data, error } = await supabase.rpc("record_quiz_session", payload);
    if (!error && data) {
      notifyProfileChanged();
      const unlocked = (data as { achievements?: { unlocked?: unknown } })
        .achievements?.unlocked;
      return {
        codes: Array.isArray(unlocked) ? (unlocked as string[]) : [],
        recorded: true,
        xpRecorded: true,
        ok: true,
      };
    }
  } catch {
    // fall through to the XP-only path below
  }

  // Degraded path: at least keep XP/streak moving if the session RPC failed.
  let xpRecorded = false;
  if (input.xp > 0) {
    try {
      const { error } = await supabase.rpc("record_activity", {
        p_xp: input.xp,
      });
      if (!error) {
        xpRecorded = true;
        notifyProfileChanged();
      }
    } catch {
      xpRecorded = false;
    }
  }
  return { codes: [], recorded: false, xpRecorded, ok: xpRecorded };
}
