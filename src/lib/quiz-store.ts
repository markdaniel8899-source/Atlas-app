import { AiError } from "./ai";
import type { Evaluation } from "./ai";
import { saveQuizSession } from "./db/quiz-sessions";
import { registerResetHandler } from "./session-reset";
import {
  canSubmit,
  evaluateAnswer,
  initialAnswer,
  requestQuiz,
  summarize,
} from "./quiz";
import type { GenerateInput, QuizAnswer, QuizAttempt } from "./quiz";

export type QuizPhase = "setup" | "loading" | "running" | "done";

export interface QuizSessionState {
  phase: QuizPhase;
  attempts: QuizAttempt[];
  index: number;
  answer: QuizAnswer;
  evaluation: Evaluation | null;
  evaluating: boolean;
  topic: string;
  error: string | null;
  unlocked: string[];
  /** Set when the finished quiz could not be written to history. */
  syncNote: string | null;
}

export const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";
const TIMEOUT_MESSAGE = "The request timed out. Please try again.";

function isOfflineError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("fetch") || msg.includes("network") || msg.includes("failed")
    );
  }
  return false;
}

function classify(error: unknown): string {
  if (isOfflineError(error)) return OFFLINE_MESSAGE;
  if (error instanceof AiError) {
    if (error.status === 0 || error.status === 503) {
      return OFFLINE_MESSAGE;
    }
    if (error.status === 408) return TIMEOUT_MESSAGE;
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

const INITIAL: QuizSessionState = {
  phase: "setup",
  attempts: [],
  index: 0,
  answer: null,
  evaluation: null,
  evaluating: false,
  topic: "",
  error: null,
  unlocked: [],
  syncNote: null,
};

/**
 * Module-level quiz store: generation and grading keep running while the
 * user switches tabs, and the session survives remounts of the screen.
 * In-memory only - a fresh app launch starts from setup.
 */
let state: QuizSessionState = INITIAL;
let snapshot: QuizSessionState = state;
/** Bumped on reset so in-flight requests cannot repopulate another account. */
let epoch = 0;
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...state };
  for (const listener of listeners) listener();
}

export function subscribeQuizSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQuizSessionSnapshot(): QuizSessionState {
  return snapshot;
}

export async function generateQuizSession(input: GenerateInput) {
  if (state.phase === "loading") return;
  const run = epoch;
  state = { ...state, phase: "loading", error: null };
  emit();
  try {
    const context = input.contextBuilder
      ? await Promise.resolve()
          .then(input.contextBuilder)
          .catch(() => input.context ?? "")
      : input.context;
    if (run !== epoch) return;
    const result = await requestQuiz({ ...input, context });
    if (run !== epoch) return;
    if (result.questions.length === 0) {
      throw new AiError("The AI returned an empty quiz. Try again.", 0);
    }
    state = {
      ...state,
      attempts: result.questions.map((item) => ({
        question: item,
        answer: initialAnswer(item),
        evaluation: null,
      })),
      topic: input.topic,
      index: 0,
      answer: initialAnswer(result.questions[0]),
      evaluation: null,
      phase: "running",
    };
    emit();
  } catch (caught) {
    if (run !== epoch) return;
    state = { ...state, error: classify(caught), phase: "setup" };
    emit();
  }
}

export async function submitQuizAnswer() {
  const question = state.attempts[state.index]?.question ?? null;
  if (
    !question ||
    state.evaluation ||
    state.evaluating ||
    !canSubmit(question, state.answer)
  ) {
    return;
  }
  const { index, answer } = state;
  const run = epoch;
  state = { ...state, evaluating: true, error: null };
  emit();
  try {
    const result = await evaluateAnswer(question, answer);
    if (run !== epoch) return;
    state = {
      ...state,
      attempts: state.attempts.map((item, position) =>
        position === index ? { ...item, answer, evaluation: result } : item,
      ),
      evaluation: result,
      evaluating: false,
    };
    emit();
  } catch (caught) {
    if (run !== epoch) return;
    state = { ...state, evaluating: false, error: classify(caught) };
    emit();
  }
}

export async function quizGoNext() {
  const { attempts, index } = state;
  const run = epoch;
  if (index >= attempts.length - 1) {
    const result = summarize(attempts);
    const saved = await saveQuizSession({
      topic: state.topic,
      kind: "mixed",
      correct: result.correct,
      total: result.total,
      xp: result.xp,
    });
    if (run !== epoch) return;
    state = {
      ...state,
      unlocked: saved.codes,
      syncNote: saved.recorded
        ? null
        : "Your result couldn't be saved to history (connection issue). XP may arrive late.",
      phase: "done",
    };
    emit();
    return;
  }
  const next = index + 1;
  state = {
    ...state,
    index: next,
    answer: initialAnswer(attempts[next].question),
    evaluation: null,
    error: null,
  };
  emit();
}

export function quizGoBack() {
  const { index, attempts } = state;
  if (index === 0) return;
  const previous = index - 1;
  state = {
    ...state,
    index: previous,
    answer: attempts[previous].answer,
    evaluation: attempts[previous].evaluation,
    error: null,
  };
  emit();
}

export function setQuizAnswer(answer: QuizAnswer) {
  state = { ...state, answer };
  emit();
}

export function quizRetake() {
  const fresh = state.attempts.map((item) => ({
    ...item,
    answer: initialAnswer(item.question),
    evaluation: null,
  }));
  state = {
    ...state,
    attempts: fresh,
    index: 0,
    answer: fresh[0] ? initialAnswer(fresh[0].question) : null,
    evaluation: null,
    error: null,
    phase: "running",
  };
  emit();
}

export function resetQuizStore() {
  epoch += 1;
  state = INITIAL;
  emit();
}

export function quizStartOver() {
  resetQuizStore();
}

export function dismissQuizError() {
  if (!state.error) return;
  state = { ...state, error: null };
  emit();
}

registerResetHandler(resetQuizStore);
