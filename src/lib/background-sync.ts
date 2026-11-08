import { AppState, Platform } from "react-native";
import { readDashboardCache, writeDashboardCache } from "./dashboard-cache";
import { getCachedProfile, hydrateProfileCache, setCachedProfile } from "./profile-cache";
import { diag } from "./diagnostics";
import { sanitizeHtml } from "./notes";
import type { Note } from "./notes";
import type { FocusCourse, FocusTopic, HeatmapDay, Profile } from "./db/types";
import { readStoredSession } from "./session-store";
import { syncAtlasNotesWidget, syncAtlasStatsWidget } from "./widgets/widget-sync";

/**
 * Background refresh for the dashboard snapshot and both Android widgets.
 *
 * The OS runs this while the app is closed (WorkManager on Android, BGTask on
 * iOS). It is deliberately read-only and uses raw REST with the stored access
 * token:
 *
 *  - No Supabase client is created here. Two JS contexts sharing one rotating
 *    refresh token previously killed sessions, so an expired token simply
 *    skips the run and the next app launch refreshes normally.
 *  - Only the dashboard/profile/widget caches are written. The shared
 *    data-cache blob belongs to the foreground app and must not be replaced
 *    from a context that only knows a few keys.
 */

const TASK_NAME = "atlas-background-sync";
const MINIMUM_INTERVAL_MIN = 15;
const REQUEST_TIMEOUT_MS = 12_000;
/** Refreshing a token that expires sooner than this is the app's job. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const PROFILE_COLUMNS =
  "id, username, display_name, streak, xp, level, avatar_url, last_active_date, weekly_xp, total_xp, day_streak";
const NOTE_COLUMNS =
  "id, title, content, created_at, updated_at, course_id, topic_id, sort_order, shared_by, shared_at";
const NOTE_COLUMNS_LEGACY =
  "id, title, content, created_at, updated_at, course_id, topic_id";
const FOCUS_SELECT =
  "id, title, accent, progress_percentage, status, " +
  "course_topics(id, title, position, status)";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function apiBase(): string {
  return (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
}

function anonKey(): string {
  return (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

interface RestResult<T> {
  ok: boolean;
  data: T | null;
}

async function rest<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<RestResult<T>> {
  const base = apiBase();
  const key = anonKey();
  if (!base || !key) return { ok: false, data: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/rest/v1${path}`, {
      method: init?.method ?? "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init?.body == null ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, data: null };
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

interface NoteRow {
  id: number | string;
  title: string | null;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  course_id: number | null;
  topic_id: number | null;
  sort_order?: number | null;
  shared_by?: string | null;
  shared_at?: string | null;
}

interface FocusRow {
  id: number;
  title: string;
  accent: string | null;
  progress_percentage: number | string | null;
  status: FocusCourse["status"];
  course_topics: FocusTopic[] | null;
}

function timeOf(iso: string | null): number {
  if (!iso) return Date.now();
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function toNote(row: NoteRow): Note {
  return {
    id: String(row.id),
    title: row.title ?? "",
    html: sanitizeHtml(row.content ?? ""),
    createdAt: timeOf(row.created_at),
    updatedAt: timeOf(row.updated_at),
    courseId: typeof row.course_id === "number" ? row.course_id : null,
    topicId: typeof row.topic_id === "number" ? row.topic_id : null,
    courseTitle: null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : null,
    sharedBy: row.shared_by ?? null,
    sharedByName: null,
    sharedAt: row.shared_at ? timeOf(row.shared_at) : null,
  };
}

function pickActiveCourse(rows: FocusRow[]): FocusRow | null {
  return (
    rows.find((row) => row.status === "in_progress") ??
    rows.find((row) => row.status === "paused") ??
    rows.find((row) => row.status === "not_started") ??
    null
  );
}

function toFocusCourse(row: FocusRow): FocusCourse {
  const topics = [...(row.course_topics ?? [])]
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      position: topic.position,
      status: topic.status,
    }))
    .sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    title: row.title,
    accent: row.accent ?? "#9db4ff",
    progress_percentage: Number(row.progress_percentage) || 0,
    status: row.status,
    topics,
  };
}

/**
 * One refresh pass. Returns false only when every request failed (offline /
 * server down) so the OS can retry with backoff. An expired token or a
 * signed-out device resolves true - there is nothing to retry until the app
 * opens again.
 */
export async function runBackgroundSync(): Promise<boolean> {
  if (AppState.currentState === "active") {
    diag("bg:skip-active");
    return true;
  }

  const session = await readStoredSession();
  const token = session?.access_token ?? "";
  const uid = session?.user?.id ?? "";
  if (!token || !uid) {
    diag("bg:skip-signed-out");
    return true;
  }
  const expiresAt = Number(session?.expires_at) || 0;
  if (expiresAt > 0 && expiresAt * 1000 - Date.now() < TOKEN_EXPIRY_MARGIN_MS) {
    // Never refresh here: a rotated refresh token in a second JS context is
    // what previously produced dead sessions.
    diag("bg:skip-expired");
    return true;
  }

  diag("bg:start", { uid: uid.slice(0, 8) });

  const [profileResult, heatmapResult, focusResult, notesResult] =
    await Promise.all([
      rest<Profile[]>(
        `/profiles?select=${encodeURIComponent(PROFILE_COLUMNS)}&id=eq.${uid}&limit=1`,
        token,
      ),
      rest<HeatmapDay[]>("/rpc/activity_heatmap", token, {
        method: "POST",
        body: { p_days: 365 },
      }),
      rest<FocusRow[]>(
        `/courses?select=${encodeURIComponent(FOCUS_SELECT)}&user_id=eq.${uid}` +
          "&order=position.asc",
        token,
      ),
      rest<NoteRow[]>(
        `/notes?select=${encodeURIComponent(NOTE_COLUMNS)}&user_id=eq.${uid}` +
          "&order=updated_at.desc&limit=20",
        token,
      ),
    ]);

  // Older schemas have no sort_order/shared_* columns; retry with the base set.
  let notes = notesResult;
  if (!notes.ok) {
    notes = await rest<NoteRow[]>(
      `/notes?select=${encodeURIComponent(NOTE_COLUMNS_LEGACY)}&user_id=eq.${uid}` +
        "&order=updated_at.desc&limit=20",
      token,
    );
  }

  const anyOk =
    profileResult.ok || heatmapResult.ok || focusResult.ok || notes.ok;
  if (!anyOk) {
    diag("bg:all-failed");
    return false;
  }

  const fetchedProfile =
    profileResult.ok && Array.isArray(profileResult.data)
      ? (profileResult.data[0] ?? null)
      : null;
  if (fetchedProfile) setCachedProfile(uid, fetchedProfile);

  await hydrateProfileCache();
  const profile = fetchedProfile ?? getCachedProfile(uid);

  const previous = await readDashboardCache(uid);
  const heatmap =
    heatmapResult.ok && Array.isArray(heatmapResult.data)
      ? heatmapResult.data
      : (previous?.heatmap ?? []);

  const focusRow =
    focusResult.ok && Array.isArray(focusResult.data)
      ? pickActiveCourse(focusResult.data)
      : null;
  const focus = focusRow
    ? toFocusCourse(focusRow)
    : (previous?.focus ?? null);

  if (heatmapResult.ok || focusResult.ok) {
    await writeDashboardCache(uid, { heatmap, focus });
  }

  syncAtlasStatsWidget(profile, heatmap);

  if (notes.ok && Array.isArray(notes.data)) {
    syncAtlasNotesWidget(notes.data.map(toNote));
  }

  if (profile) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: keeps the headless task light
      const { syncStreakReminder } = require("./notifications") as typeof import("./notifications");
      await syncStreakReminder({
        streak: Number(profile.streak) || 0,
        lastActiveDate: profile.last_active_date ?? null,
      });
    } catch (error) {
      diag("bg:reminder-fail", { message: describe(error) });
    }
  }

  diag("bg:done", {
    profile: profileResult.ok ? "1" : "0",
    heatmap: heatmapResult.ok ? "1" : "0",
    focus: focusResult.ok ? "1" : "0",
    notes: notes.ok ? "1" : "0",
  });
  return true;
}

// -- Task registration -------------------------------------------------------
// expo-task-manager / expo-background-task are native modules: the installed
// APK (and Expo Go / web) may not contain them, so they are required lazily
// and every failure is swallowed. The task activates with the next build.

type TaskManagerModule = typeof import("expo-task-manager");
type BackgroundTaskModule = typeof import("expo-background-task");

let taskManager: TaskManagerModule | null = null;
let backgroundTask: BackgroundTaskModule | null = null;
let loaded = false;

function loadModules(): boolean {
  if (loaded) return Boolean(taskManager && backgroundTask);
  loaded = true;
  if (Platform.OS === "web") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without these native modules
    taskManager = require("expo-task-manager") as TaskManagerModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without these native modules
    backgroundTask = require("expo-background-task") as BackgroundTaskModule;
    return true;
  } catch (error) {
    diag("bg:require-fail", { message: describe(error) });
    taskManager = null;
    backgroundTask = null;
    return false;
  }
}

/**
 * Defines (once) and registers the background task. Must run at global scope
 * on every JS launch - including headless ones - so the OS can find it.
 */
export function registerAtlasBackgroundSync(): void {
  if (!loadModules() || !taskManager || !backgroundTask) return;

  try {
    if (!taskManager.isTaskDefined(TASK_NAME)) {
      taskManager.defineTask(TASK_NAME, async () => {
        try {
          const ok = await runBackgroundSync();
          return ok
            ? backgroundTask!.BackgroundTaskResult.Success
            : backgroundTask!.BackgroundTaskResult.Failed;
        } catch (error) {
          diag("bg:task-fail", { message: describe(error) });
          return backgroundTask!.BackgroundTaskResult.Failed;
        }
      });
    }
  } catch (error) {
    diag("bg:define-fail", { message: describe(error) });
    return;
  }

  void (async () => {
    try {
      const status = await backgroundTask!.getStatusAsync();
      if (status !== backgroundTask!.BackgroundTaskStatus.Available) {
        diag("bg:status-restricted");
        return;
      }
      const registered = await taskManager!.isTaskRegisteredAsync(TASK_NAME);
      if (registered) return;
      await backgroundTask!.registerTaskAsync(TASK_NAME, {
        minimumInterval: MINIMUM_INTERVAL_MIN,
      });
      diag("bg:registered");
    } catch (error) {
      diag("bg:register-fail", { message: describe(error) });
    }
  })();
}
