import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { defaultTimerState, loadTimerState } from "./timer";
import type { TimerMode, TimerState } from "./timer";

/**
 * Cross-device timer sync.
 *
 * The running timer is mirrored into one `focus_timers` row per account so a
 * session started on the website shows up here (and vice versa). The local
 * timer stays authoritative while offline: a `dirty` flag records unsynced
 * transitions and the next online/foreground pass pushes them before pulling.
 */

const DEVICE_KEY = "atlas.timer.device.v1";
const META_PREFIX = "atlas.timer.sync.v1";

export const TIMER_SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface TimerSyncMeta {
  dirty: boolean;
  remoteUpdatedAt: string | null;
  localUpdatedAt: number | null;
  deviceId: string;
}

interface RemoteRow {
  user_id?: string;
  mode?: string;
  started_at?: string | null;
  accumulated_ms?: number | string | null;
  target_min?: number | string | null;
  course_id?: number | string | null;
  flushed_ms?: number | string | null;
  device_id?: string | null;
  updated_at?: string;
}

export interface RemoteTimer {
  state: TimerState;
  updatedAt: string;
  deviceId: string | null;
}

let deviceIdCache: string | null = null;

/** Synchronous peek for realtime self-echo filtering. */
export function cachedDeviceId(): string | null {
  return deviceIdCache;
}

function makeDeviceId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);
    if (stored) {
      deviceIdCache = stored;
      return stored;
    }
  } catch {
    // Fall through to a fresh id.
  }
  const next = makeDeviceId();
  deviceIdCache = next;
  try {
    await AsyncStorage.setItem(DEVICE_KEY, next);
  } catch {
    // A memory-only id still works for this app run.
  }
  return next;
}

function metaKey(ownerId: string): string {
  return `${META_PREFIX}.${ownerId}`;
}

export async function loadTimerSyncMeta(
  ownerId: string,
): Promise<TimerSyncMeta> {
  const deviceId = await ensureDeviceId();
  try {
    const raw = await AsyncStorage.getItem(metaKey(ownerId));
    if (!raw) return { dirty: false, remoteUpdatedAt: null, localUpdatedAt: null, deviceId };
    const parsed = JSON.parse(raw) as Partial<TimerSyncMeta>;
    return {
      dirty: parsed.dirty === true,
      remoteUpdatedAt:
        typeof parsed.remoteUpdatedAt === "string"
          ? parsed.remoteUpdatedAt
          : null,
      localUpdatedAt:
        typeof parsed.localUpdatedAt === "number" &&
        Number.isFinite(parsed.localUpdatedAt)
          ? parsed.localUpdatedAt
          : null,
      deviceId,
    };
  } catch {
    return { dirty: false, remoteUpdatedAt: null, localUpdatedAt: null, deviceId };
  }
}

export async function saveTimerSyncMeta(
  ownerId: string,
  meta: TimerSyncMeta,
): Promise<void> {
  try {
    await AsyncStorage.setItem(metaKey(ownerId), JSON.stringify(meta));
  } catch {
    // Best effort - the next transition rewrites it.
  }
}

function toNumber(value: unknown, fallback: number): number {
  const next = typeof value === "string" ? Number(value) : value;
  return typeof next === "number" && Number.isFinite(next) ? next : fallback;
}

function toMode(value: unknown): TimerMode {
  return value === "running" || value === "paused" ? value : "idle";
}

export function rowToTimer(row: RemoteRow): RemoteTimer | null {
  const updatedAt =
    typeof row.updated_at === "string" ? row.updated_at : null;
  if (!updatedAt) return null;

  const mode = toMode(row.mode);
  const targetMin = Math.max(1, Math.round(toNumber(row.target_min, 25)));
  const parsedStart = Date.parse(row.started_at ?? "");
  const startedAt =
    mode === "running" && Number.isFinite(parsedStart) ? parsedStart : null;
  const parsedCourse = Math.round(toNumber(row.course_id, 0));
  const courseId = parsedCourse > 0 ? parsedCourse : null;
  const state: TimerState =
    mode === "running" && startedAt === null
      ? defaultTimerState(targetMin)
      : {
          mode,
          startedAt,
          accumulatedMs: Math.max(
            0,
            Math.round(toNumber(row.accumulated_ms, 0)),
          ),
          targetMin,
          courseId,
          flushedMs: Math.max(0, Math.round(toNumber(row.flushed_ms, 0))),
        };

  return {
    state,
    updatedAt,
    deviceId: typeof row.device_id === "string" ? row.device_id : null,
  };
}

export interface RemoteFetch {
  /** False when the request itself failed (offline / missing table). */
  ok: boolean;
  remote: RemoteTimer | null;
}

export async function fetchRemoteTimer(ownerId: string): Promise<RemoteFetch> {
  try {
    const { data, error } = await supabase
      .from("focus_timers")
      .select(
        "user_id, mode, started_at, accumulated_ms, target_min, course_id, flushed_ms, device_id, updated_at",
      )
      .eq("user_id", ownerId)
      .maybeSingle();
    if (error) return { ok: false, remote: null };
    if (!data) return { ok: true, remote: null };
    return { ok: true, remote: rowToTimer(data as RemoteRow) };
  } catch {
    return { ok: false, remote: null };
  }
}

let pushChain: Promise<unknown> = Promise.resolve();

/**
 * Upsert this device's timer row. Calls are serialised so a quick
 * start -> pause -> stop keeps the last transition last on the server.
 * Returns the server `updated_at` on success, null when offline/failed.
 */
export function pushTimerState(
  ownerId: string,
  state: TimerState,
  deviceId: string,
): Promise<string | null> {
  const run = pushChain.then(
    async () => {
      try {
        const { data, error } = await supabase
          .from("focus_timers")
          .upsert(
            {
              user_id: ownerId,
              mode: state.mode,
              started_at:
                state.mode === "running" && state.startedAt !== null
                  ? new Date(state.startedAt).toISOString()
                  : null,
              accumulated_ms: Math.max(0, Math.round(state.accumulatedMs)),
              target_min: Math.max(1, Math.round(state.targetMin)),
              course_id: state.courseId,
              flushed_ms: Math.max(0, Math.round(state.flushedMs)),
              device_id: deviceId,
            },
            { onConflict: "user_id" },
          )
          .select("updated_at")
          .maybeSingle();
        if (error || !data) return null;
        const updatedAt = (data as { updated_at?: unknown }).updated_at;
        return typeof updatedAt === "string" ? updatedAt : null;
      } catch {
        return null;
      }
    },
    async () => null,
  );
  pushChain = run.catch(() => null);
  return run;
}

export async function markTimerDirty(
  ownerId: string,
  deviceId: string,
): Promise<TimerSyncMeta> {
  const meta = await loadTimerSyncMeta(ownerId);
  const next: TimerSyncMeta = {
    ...meta,
    dirty: true,
    localUpdatedAt: Date.now(),
    deviceId,
  };
  await saveTimerSyncMeta(ownerId, next);
  return next;
}

export async function markTimerSynced(
  ownerId: string,
  updatedAt: string,
  deviceId: string,
): Promise<void> {
  const meta = await loadTimerSyncMeta(ownerId);
  await saveTimerSyncMeta(ownerId, {
    ...meta,
    dirty: false,
    remoteUpdatedAt: updatedAt,
    deviceId,
  });
}

/** Stops a running local session on the server before sign-out. */
export async function stopRemoteTimer(ownerId: string): Promise<void> {
  try {
    const state = await loadTimerState(ownerId);
    if (state.mode === "idle") return;
    const deviceId = await ensureDeviceId();
    const task = (async () => {
      const updatedAt = await pushTimerState(
        ownerId,
        defaultTimerState(state.targetMin),
        deviceId,
      );
      if (updatedAt) await markTimerSynced(ownerId, updatedAt, deviceId);
    })();
    // Sign-out must stay instant even on a dead connection.
    await Promise.race([
      task,
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Best effort only.
  }
}

export type TimerSyncDecision =
  | { type: "adopt"; remote: RemoteTimer }
  | { type: "push"; state: TimerState }
  | { type: "none" };

function sameTimerState(a: TimerState, b: TimerState): boolean {
  return (
    a.mode === b.mode &&
    a.startedAt === b.startedAt &&
    a.accumulatedMs === b.accumulatedMs &&
    a.targetMin === b.targetMin &&
    a.courseId === b.courseId &&
    a.flushedMs === b.flushedMs
  );
}

/**
 * Resolve local vs remote after a hydrate / foreground / realtime wake-up.
 * Local unsynced changes win; otherwise the newer server row is adopted.
 * A server row still "running" a day later is abandoned and cleared.
 */
export async function decideTimerSync(
  ownerId: string,
  local: TimerState,
): Promise<TimerSyncDecision> {
  const meta = await loadTimerSyncMeta(ownerId);
  if (meta.dirty) return { type: "push", state: local };

  const fetched = await fetchRemoteTimer(ownerId);
  // Unknown server state (offline): keep the clean local timer as-is. Marking
  // it dirty here would let a stale local run overwrite a newer remote one.
  if (!fetched.ok) return { type: "none" };
  const remote = fetched.remote;
  if (!remote) {
    return local.mode !== "idle" || local.flushedMs > 0
      ? { type: "push", state: local }
      : { type: "none" };
  }

  // First contact from this device has no sync timestamp yet. A running
  // server session is the cross-device case we care about, so it wins over a
  // stale local run; otherwise the later `updated_at` wins.
  let remoteNewer: boolean;
  if (meta.remoteUpdatedAt) {
    remoteNewer = remote.updatedAt > meta.remoteUpdatedAt;
  } else if (
    remote.state.mode === "running" &&
    local.mode === "running" &&
    local.startedAt !== null &&
    remote.state.startedAt !== null
  ) {
    remoteNewer = remote.state.startedAt >= local.startedAt;
  } else if (remote.state.mode === "running") {
    remoteNewer = true;
  } else if (local.mode === "running" && local.startedAt !== null) {
    const remoteTime = Date.parse(remote.updatedAt);
    remoteNewer = !(Number.isFinite(remoteTime) && local.startedAt > remoteTime);
  } else {
    remoteNewer = true;
  }

  if (!remoteNewer) {
    if (sameTimerState(local, remote.state)) {
      return { type: "adopt", remote };
    }
    return local.mode !== "idle"
      ? { type: "push", state: local }
      : { type: "none" };
  }

  if (
    remote.state.mode === "running" &&
    remote.state.startedAt !== null &&
    Date.now() - remote.state.startedAt > TIMER_SYNC_MAX_AGE_MS
  ) {
    return { type: "push", state: defaultTimerState(remote.state.targetMin) };
  }

  return { type: "adopt", remote };
}
