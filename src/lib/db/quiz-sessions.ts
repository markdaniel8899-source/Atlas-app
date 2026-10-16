import { notifyProfileChanged } from "../events";
import { supabase } from "../supabase";

export interface QuizSessionInput {
  topic: string;
  kind?: string;
  correct: number;
  total: number;
  xp: number;
}

/**
 * Persists a finished quiz (feeds the achievement engine), awards XP and
 * refreshes the streak via the `record_quiz_session` RPC. Returns the codes
 * of any achievements unlocked by this run.
 */
export async function saveQuizSession(
  input: QuizSessionInput,
): Promise<string[]> {
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
      return Array.isArray(unlocked) ? (unlocked as string[]) : [];
    }
  } catch {
    // fall through to the XP-only path below
  }

  // Degraded path: at least keep XP/streak moving if the session RPC failed.
  if (input.xp > 0) {
    await supabase.rpc("record_activity", { p_xp: input.xp });
    notifyProfileChanged();
  }
  return [];
}
