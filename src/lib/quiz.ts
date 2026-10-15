import { evaluateCode, generateQuiz } from '@/lib/ai';
import type {
  AiAnswer,
  Difficulty,
  Evaluation,
  QuizKind,
  QuizQuestion,
  QuizResult,
} from '@/lib/ai';

export type QuizAnswer = AiAnswer;
export type KindChoice = QuizKind | 'mixed';

export interface QuizAttempt {
  question: QuizQuestion;
  answer: QuizAnswer;
  evaluation: Evaluation | null;
}

export interface QuizSummary {
  correct: number;
  total: number;
  percent: number;
  xp: number;
}

export interface GenerateInput {
  topic: string;
  kind: KindChoice;
  count: number;
  difficulty: Difficulty;
  context?: string;
  courseId?: number | null;
  subject?: string;
}

export const QUIZ_KINDS: readonly QuizKind[] = ['mcq', 'code', 'debug', 'output'];

export const XP_PER_CORRECT = 10;

export const KIND_LABEL: Record<KindChoice, string> = {
  mixed: 'Mixed set',
  mcq: 'Multiple choice',
  code: 'Code generation',
  debug: 'Debugging',
  output: 'Output prediction',
};

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

export async function requestQuiz(input: GenerateInput): Promise<QuizResult> {
  const options = {
    difficulty: input.difficulty,
    context: input.context ?? '',
    courseId: input.courseId ?? null,
    subject: input.subject ?? '',
  };
  const run = (kind: QuizKind, count: number): Promise<QuizResult> =>
    generateQuiz(input.topic, kind, count, options);

  if (input.kind !== 'mixed') {
    return run(input.kind, input.count);
  }

  const perKind = Math.max(1, Math.ceil(input.count / QUIZ_KINDS.length));
  const batches = await Promise.allSettled(
    QUIZ_KINDS.map((kind) => run(kind, perKind)),
  );

  const settled = batches.filter(
    (result): result is PromiseFulfilledResult<QuizResult> =>
      result.status === 'fulfilled',
  );
  if (settled.length === 0) {
    const first = batches[0] as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error
      ? first.reason
      : new Error('Quiz generation failed.');
  }

  const questions = shuffle(
    settled.flatMap((batch) => batch.value.questions),
  ).slice(0, input.count);

  return {
    questions,
    model: settled[0].value.model,
  };
}

export function canSubmit(question: QuizQuestion, answer: QuizAnswer): boolean {
  if (answer === null || answer === undefined) return false;
  if (question.kind === 'mcq') return typeof answer === 'number';

  const text = String(answer);
  if (!text.trim()) return false;
  if (question.kind === 'debug') {
    const fix = text.split('\n').slice(1).join('\n');
    return Boolean(fix.trim());
  }
  return true;
}

export async function evaluateAnswer(
  question: QuizQuestion,
  answer: QuizAnswer,
): Promise<Evaluation> {
  if (question.kind === 'mcq') {
    const correct =
      typeof answer === 'number' && answer === question.correct_index;
    return {
      is_correct: correct,
      score: correct ? 100 : 0,
      feedback: correct
        ? 'Correct - that is the right answer.'
        : question.explanation.trim() ||
          'Not quite. Reread the options and see which one the question is really asking for.',
      model: null,
    };
  }

  const submitted =
    question.kind === 'code' ? String(answer ?? '') : question.code;

  return evaluateCode(question.kind, question.prompt, answer, submitted, {
    language: question.language || 'python',
    referenceSolution: question.reference_solution,
    expectedOutput: question.correct_output,
    buggyLine: question.buggy_line,
  });
}

export function summarize(attempts: QuizAttempt[]): QuizSummary {
  const total = attempts.length;
  const correct = attempts.filter(
    (attempt) => attempt.evaluation?.is_correct,
  ).length;
  return {
    correct,
    total,
    percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    xp: correct * XP_PER_CORRECT,
  };
}

export function initialAnswer(question: QuizQuestion): QuizAnswer {
  if (question.kind === 'mcq') return null;
  if (question.kind === 'code') return question.starter_code || '';
  return '';
}
