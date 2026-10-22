import { supabase } from "./supabase";
import { getAiBaseUrl } from "./api-config";
import { resolveSession } from "./auth";

const REQUEST_TIMEOUT_MS = 90_000;
const ROADMAP_TIMEOUT_MS = 180_000;
const PDF_TIMEOUT_MS = 120_000;

export type QuizKind = "mcq" | "code" | "debug" | "output";
export type Difficulty = "easy" | "medium" | "hard";
export type AiAnswer = string | number | number[] | null;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

export type RoadmapResourceType =
  | "video"
  | "article"
  | "book"
  | "course"
  | "practice"
  | "docs";

export interface RoadmapResource {
  type: RoadmapResourceType;
  title: string;
  url: string;
}

export interface RoadmapNode {
  key: string;
  title: string;
  description: string;
  phase_number: number;
  estimated_hours: number;
  prerequisites: string[];
  resources: RoadmapResource[];
  type?: "regular" | "boss";
  estimated_days?: number;
  quiz_required?: boolean;
  objectives?: string[];
}

export interface RoadmapPhase {
  number: number;
  title: string;
  objective: string;
  duration_weeks: number;
  hours: number;
  milestones: string[];
  nodes: RoadmapNode[];
}

export interface RoadmapConnection {
  source: string;
  target: string;
}

export interface Roadmap {
  title: string;
  summary: string;
  phases: RoadmapPhase[];
  connections: RoadmapConnection[];
}

export interface RoadmapOutlinePhase {
  number: number;
  title: string;
  objective: string;
}

export interface RoadmapOutlineResult {
  title: string;
  summary: string;
  phases: RoadmapOutlinePhase[];
  model: string;
}

export interface RoadmapPhaseResult {
  phase: RoadmapPhase;
  model: string;
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

export interface RoadmapOptions {
  durationWeeks?: number;
  topics?: string[];
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
  code?: string;
  referenceSolution?: string;
  expectedOutput?: string;
  buggyLine?: number | null;
  correctIndex?: number | null;
}

export interface NativeFile {
  uri: string;
  name: string;
  type: string;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    return "";
  }
  return "";
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const user = await resolveSession();
    if (!user) return {};

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    console.log("🔐 Mobile Auth Token:", token ? `${token.slice(0, 15)}...` : "MISSING");

    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (error) {
    console.error("❌ Error in authHeaders:", error);
    return {};
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
}

async function fetchWithConnectTimeout(
  url: string,
  init: RequestInit,
  totalTimeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), totalTimeoutMs);

  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(totalTimer);
  }
}

async function request<T>(
  path: string,
  body: unknown,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T> {
  const base = getAiBaseUrl();
  if (!base) {
    throw new AiError("AI Service Unavailable. Please try again later.", 0);
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    console.log("🌐 API Request Headers:", JSON.stringify(headers));

    const response = await fetchWithConnectTimeout(
      `${base}${path}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      },
      timeoutMs,
    );

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
    if (isAbortError(error)) {
      throw new AiError("The request timed out. Try again.", 408);
    }
    // Network errors (TypeError, fetch failures) get a distinct status for retry UI
    if (error instanceof TypeError || (error instanceof Error && (
      error.name === "NetworkError" ||
      error.message.includes("network") ||
      error.message.includes("fetch") ||
      error.message.includes("Failed to fetch")
    ))) {
      throw new AiError("Network connection lost. Check your internet and retry.", 503);
    }
    throw new AiError("Something went wrong. Please try again.", 0);
  }
}

export async function generateRoadmapOutline(
  goal: string,
  hours: number,
  level: string,
  options: RoadmapOptions = {},
  signal?: AbortSignal,
): Promise<RoadmapOutlineResult> {
  const body: Record<string, unknown> = {
    goal,
    hours_per_week: hours,
    current_level: level,
    topics: options.topics ?? [],
  };
  if (options.durationWeeks != null) {
    body.duration_weeks = options.durationWeeks;
  }
  return request<RoadmapOutlineResult>(
    "/api/roadmaps/outline",
    body,
    ROADMAP_TIMEOUT_MS,
    signal,
  );
}

export interface RoadmapPhaseParams {
  goal: string;
  hours: number;
  level: string;
  outline: RoadmapOutlinePhase[];
  phaseNumber: number;
  doneTitles: string[];
}

export async function generateRoadmapPhase(
  params: RoadmapPhaseParams,
  signal?: AbortSignal,
): Promise<RoadmapPhaseResult> {
  return request<RoadmapPhaseResult>(
    "/api/roadmaps/phase",
    {
      goal: params.goal,
      hours_per_week: params.hours,
      current_level: params.level,
      outline: params.outline,
      phase_number: params.phaseNumber,
      done_titles: params.doneTitles.slice(0, 40),
    },
    ROADMAP_TIMEOUT_MS,
    signal,
  );
}

export async function generateQuiz(
  topic: string,
  kind: QuizKind,
  count: number,
  options: QuizOptions = {},
  signal?: AbortSignal,
): Promise<QuizResult> {
  return request<QuizResult>(
    "/api/quizzes/generate",
    {
      topic,
      kind,
      count,
      difficulty: options.difficulty ?? "medium",
      language: options.language ?? "python",
      context: options.context ?? "",
      course_id: options.courseId ?? null,
      subject: options.subject ?? "",
    },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}

export async function generateQuizFromPdf(
  file: NativeFile,
  topic: string,
  kind: QuizKind,
  count: number,
  options: QuizOptions = {},
  signal?: AbortSignal,
): Promise<QuizResult> {
  const base = getAiBaseUrl();
  if (!base) {
    throw new AiError("AI Service Unavailable. Please try again later.", 0);
  }

  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  const form = new FormData();
  form.append("file", file as unknown as Blob);
  form.append("topic", topic);
  form.append("kind", kind);
  form.append("count", String(count));
  form.append("difficulty", options.difficulty ?? "medium");
  form.append("language", options.language ?? "python");
  form.append("context", options.context ?? "");
  form.append("course_id", String(options.courseId ?? 0));
  form.append("subject", options.subject ?? "");

  try {
    const response = await fetch(`${base}/api/quizzes/generate-pdf`, {
      method: "POST",
      headers: await authHeaders(),
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new AiError(
        detail || `AI request failed with status ${response.status}.`,
        response.status,
      );
    }

    return (await response.json()) as QuizResult;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (isAbortError(error)) {
      throw new AiError("The request timed out. Try again.", 408);
    }
    throw new AiError("Something went wrong. Please try again.", 0);
  } finally {
    clearTimeout(totalTimer);
  }
}

export async function evaluateCode(
  kind: QuizKind,
  question: string,
  answer: AiAnswer,
  code = "",
  options: EvaluateOptions = {},
  signal?: AbortSignal,
): Promise<Evaluation> {
  return request<Evaluation>(
    "/api/quizzes/evaluate",
    {
      kind,
      question,
      answer,
      code,
      language: options.language ?? "python",
      reference_solution: options.referenceSolution ?? "",
      expected_output: options.expectedOutput ?? "",
      buggy_line: options.buggyLine ?? null,
      correct_index: options.correctIndex ?? null,
    },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  userName?: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  return request<ChatResult>(
    "/api/chat",
    {
      message,
      history,
      user_name: (userName ?? "").trim().slice(0, 120),
    },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}