import { AiError, chat } from "./ai";
import type { ChatMessage } from "./ai";
import type { FocusCourse, Profile } from "./db/types";

export interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
}

export interface AssistantProfileContext {
  profile: Profile | null;
  focus: FocusCourse | null;
}

export const OFFLINE_MESSAGE = "Something went wrong. Please try again.";
export const TIMEOUT_MESSAGE = "That took too long. Please try again.";
export const EMPTY_MESSAGE = "Type a question first.";

/** History window the backend keeps; we mirror it so requests stay small. */
const HISTORY_LIMIT = 12;

export const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "Plan my week", prompt: "Build me a study plan for this week based on my current course." },
  { label: "Explain a concept", prompt: "Explain recursion with one small code example." },
  { label: "Quiz me", prompt: "Give me 3 quick MCQ questions on the topics I'm learning." },
  { label: "Debug my code", prompt: "Why does this Python loop print nothing? for i in range(10) pass" },
  { label: "Unblock me", prompt: "I'm stuck on my current course. What should I do next?" },
];

export function newTurnId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Learner context sent as a system turn so every answer lands in context
 * without the model having to ask for stats first.
 */
export function buildLearnerContext({
  profile,
  focus,
}: AssistantProfileContext): string | null {
  const lines: string[] = [];

  const name = profile?.display_name?.trim();
  if (name) lines.push(`Learner name: ${name}`);

  if (profile) {
    lines.push(
      `Level ${profile.level} · ${profile.xp} XP · ${profile.streak}-day streak`,
    );
  }

  if (focus) {
    lines.push(
      `Current course: ${focus.title} (${Math.round(focus.progress_percentage)}% complete)`,
    );
    const topics = (focus.topics ?? [])
      .map((topic) => topic.title)
      .filter(Boolean);
    if (topics.length > 0) {
      lines.push(`Active focus topics: ${topics.slice(0, 6).join(", ")}`);
    }
  }

  if (lines.length === 0) return null;

  return [
    "Learner context (use it naturally, never recite it back):",
    ...lines,
    "Be concrete, prefer short code examples, and keep replies under ~150 words.",
  ].join("\n");
}

/** System turn first, then the prior turns, capped to what the backend keeps. */
export function toHistory(turns: Turn[], systemPrompt: string | null): ChatMessage[] {
  const history: ChatMessage[] = [];

  if (systemPrompt && systemPrompt.trim()) {
    history.push({ role: "system", content: systemPrompt.trim().slice(0, 8000) });
  }

  const prior = turns.filter((turn) => turn.content.trim().length > 0);
  for (const turn of prior.slice(-HISTORY_LIMIT)) {
    history.push({
      role: turn.role,
      content: turn.content.trim().slice(0, 8000),
    });
  }

  return history;
}

export function classify(error: unknown): string {
  if (error instanceof AiError) {
    if (error.status === 0 || error.status === 503) return OFFLINE_MESSAGE;
    if (error.status === 408) return TIMEOUT_MESSAGE;
    return error.message || "Something went wrong.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function validate(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return EMPTY_MESSAGE;
  if (trimmed.length > 8000) return "That message is too long (8000 characters max).";
  return null;
}

export async function ask(
  message: string,
  turns: Turn[],
  systemPrompt: string | null,
  userName?: string,
): Promise<Turn> {
  const history = toHistory(turns, systemPrompt);
  const result = await chat(message, history, userName);
  return {
    id: newTurnId(),
    role: "assistant",
    content: result.reply,
    model: result.model,
  };
}
