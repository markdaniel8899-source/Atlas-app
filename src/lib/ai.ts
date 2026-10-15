import { supabase } from '@/lib/supabase';

const rawBase: string =
  process.env.EXPO_PUBLIC_AI_API_URL?.trim() ??
  process.env.EXPO_PUBLIC_API_URL?.trim() ??
  '';

export const AI_BASE_URL = rawBase.replace(/\/+$/, '');

export const AI_CONFIGURED = AI_BASE_URL.length > 0;

const REQUEST_TIMEOUT_MS = 90_000;
const ROADMAP_TIMEOUT_MS = 180_000;

export type QuizKind = 'mcq' | 'code' | 'debug' | 'output';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type AiAnswer = string | number | number[] | null;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

export interface QuizQuestion {
  kind: QuizKind;
  prompt: string;
  code: string;
  starter_code: string;
  language: string;
  options: string[];
  correct_index: number | null;
  correct_output: string;
  buggy_line: number | null;
  reference_solution: string;
  rubric: string[];
  explanation: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
  model: string;
}

export interface Evaluation {
  is_correct: boolean;
  score: number;
  feedback: string;
  model: string | null;
}

export interface ChatResult {
  reply: string;
  model: string;
}

export interface RoadmapOutlinePhase {
  number: number;
  title: string;
  objective: string;
  duration_weeks: number;
  hours: number;
  milestones: string[];
}

export interface RoadmapOutlineResult {
  title: string;
  summary: string;
  phases: RoadmapOutlinePhase[];
  model: string;
}

export interface QuizOptions {
  difficulty?: Difficulty;
  language?: string;
  context?: string;
  courseId?: number | null;
  subject?: string;
}

export interface EvaluateOptions {
  language?: string;
  referenceSolution?: string;
  expectedOutput?: string;
  buggyLine?: number | null;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    return '';
  }
  return '';
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase?.auth.getSession() ?? { data: null };
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  body: unknown,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  if (!AI_CONFIGURED) {
    throw new AiError('AI service is not configured. Set EXPO_PUBLIC_AI_API_URL in .env.', 0);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new AiError(
        detail || `AI request failed with status ${response.status}.`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiError('The request timed out. Try again.', 408);
    }
    if (
      error instanceof TypeError ||
      (error instanceof Error && /network|fetch failed/i.test(error.message))
    ) {
      throw new AiError(
        'Network unavailable. Check your connection and try again.',
        0,
      );
    }
    throw new AiError('Something went wrong. Please try again.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateRoadmapOutline(
  goal: string,
  hours: number,
  level: string,
  durationWeeks?: number,
): Promise<RoadmapOutlineResult> {
  const body: Record<string, unknown> = {
    goal,
    hours_per_week: hours,
    current_level: level,
    topics: [],
  };
  if (durationWeeks != null) {
    body.duration_weeks = durationWeeks;
  }
  return request<RoadmapOutlineResult>('/api/roadmaps/outline', body, ROADMAP_TIMEOUT_MS);
}

export async function generateQuiz(
  topic: string,
  kind: QuizKind,
  count: number,
  options: QuizOptions = {},
): Promise<QuizResult> {
  return request<QuizResult>('/api/quizzes/generate', {
    topic,
    kind,
    count,
    difficulty: options.difficulty ?? 'medium',
    language: options.language ?? 'python',
    context: options.context ?? '',
    course_id: options.courseId ?? null,
    subject: options.subject ?? '',
  });
}

export async function evaluateCode(
  kind: QuizKind,
  question: string,
  answer: AiAnswer,
  code = '',
  options: EvaluateOptions = {},
): Promise<Evaluation> {
  return request<Evaluation>('/api/quizzes/evaluate', {
    kind,
    question,
    answer,
    code,
    language: options.language ?? 'python',
    reference_solution: options.referenceSolution ?? '',
    expected_output: options.expectedOutput ?? '',
    buggy_line: options.buggyLine ?? null,
    correct_index: null,
  });
}

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  userName?: string,
): Promise<ChatResult> {
  return request<ChatResult>('/api/chat', {
    message,
    history,
    user_name: (userName ?? '').trim().slice(0, 120),
  });
}
