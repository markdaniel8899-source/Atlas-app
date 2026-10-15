import { supabase } from '@/lib/supabase';

import { notifyProfileChanged } from './events';

export interface QuizSessionInput {
  topic: string;
  kind?: string;
  correct: number;
  total: number;
  xp: number;
}

export async function saveQuizSession(input: QuizSessionInput): Promise<string[]> {
  if (!supabase) return [];

  const payload = {
    p_topic: input.topic.slice(0, 160),
    p_kind: input.kind ?? 'mixed',
    p_correct: Math.max(0, input.correct),
    p_total: Math.max(0, input.total),
    p_xp: Math.max(0, input.xp),
  };

  try {
    const { data, error } = await supabase.rpc('record_quiz_session', payload);
    if (!error && data) {
      notifyProfileChanged();
      const unlocked = (
        data as { achievements?: { unlocked?: unknown } }
      ).achievements?.unlocked;
      return Array.isArray(unlocked) ? (unlocked as string[]) : [];
    }
  } catch {
    // fall through to the XP-only path below
  }

  if (input.xp > 0) {
    await supabase.rpc('record_activity', { p_xp: input.xp });
    notifyProfileChanged();
  }
  return [];
}
