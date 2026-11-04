import AsyncStorage from "@react-native-async-storage/async-storage";

const LOG_KEY = "atlas.diag.log.v1";
const ERROR_KEY = "atlas.diag.error.v1";
const MAX_LOG = 50;
const PREVIOUS_RUN_WINDOW_MS = 30 * 60 * 1000;

export interface DiagEntry {
  t: number;
  tag: string;
  extra?: string;
}

export interface DiagError {
  t: number;
  source: string;
  message: string;
  stack: string | null;
  log: DiagEntry[];
}

let log: DiagEntry[] = [];
let previousLog: DiagEntry[] = [];
let lastError: DiagError | null = null;
let hydrated: Promise<void> | null = null;
let ready = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken subscriber must not break diagnostics.
    }
  }
}

function safeJson(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    const text = JSON.stringify(value);
    if (!text) return undefined;
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  } catch {
    return String(value);
  }
}

function toError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? null };
  }
  if (typeof error === "string") return { message: error, stack: null };
  try {
    return { message: JSON.stringify(error), stack: null };
  } catch {
    return { message: String(error), stack: null };
  }
}

function parseLog(raw: string | null): DiagEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DiagEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<DiagEntry>;
      return typeof item.t === "number" && typeof item.tag === "string";
    });
  } catch {
    return [];
  }
}

export function hydrateDiagnostics(): Promise<void> {
  if (hydrated) return hydrated;
  hydrated = (async () => {
    try {
      const [logRaw, errorRaw] = await Promise.all([
        AsyncStorage.getItem(LOG_KEY),
        AsyncStorage.getItem(ERROR_KEY),
      ]);
      previousLog = parseLog(logRaw);
      if (errorRaw) {
        const parsed = JSON.parse(errorRaw) as Partial<DiagError>;
        if (parsed && typeof parsed.message === "string") {
          lastError = {
            t: typeof parsed.t === "number" ? parsed.t : 0,
            source: typeof parsed.source === "string" ? parsed.source : "unknown",
            message: parsed.message,
            stack: typeof parsed.stack === "string" ? parsed.stack : null,
            log: Array.isArray(parsed.log) ? parsed.log : [],
          };
        }
      }
    } catch {
      // A corrupt log is not fatal.
    }
    ready = true;
    if (log.length > 0) {
      void AsyncStorage.setItem(LOG_KEY, JSON.stringify(log)).catch(
        () => undefined,
      );
    }
    emit();
  })();
  return hydrated;
}

export function getDiagLog(): DiagEntry[] {
  return log;
}

export function getPreviousDiagLog(): DiagEntry[] {
  return previousLog;
}

export function getLastDiagError(): DiagError | null {
  return lastError;
}

export function subscribeDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function diag(tag: string, extra?: unknown): void {
  const entry: DiagEntry = { t: Date.now(), tag, extra: safeJson(extra) };
  log = [...log.slice(-(MAX_LOG - 1)), entry];
  if (ready) {
    void AsyncStorage.setItem(LOG_KEY, JSON.stringify(log)).catch(
      () => undefined,
    );
  }
  emit();
}

export function diagError(error: unknown, source: string): void {
  const info = toError(error);
  lastError = {
    t: Date.now(),
    source,
    message: info.message,
    stack: info.stack,
    log: log.slice(-20),
  };
  void AsyncStorage.setItem(ERROR_KEY, JSON.stringify(lastError)).catch(
    () => undefined,
  );
  emit();
}

export function clearDiagError(): void {
  lastError = null;
  void AsyncStorage.removeItem(ERROR_KEY).catch(() => undefined);
  emit();
}

export function previousRunCrashed(): DiagEntry | null {
  if (previousLog.length === 0) return null;
  const last = previousLog[previousLog.length - 1];
  if (!last) return null;
  if (last.tag === "app:background" || last.tag === "app:exit") return null;
  if (Date.now() - last.t > PREVIOUS_RUN_WINDOW_MS) return null;
  return last;
}

interface GlobalErrorUtils {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (
    handler: (error: Error, isFatal?: boolean) => void,
  ) => void;
  __atlasDiagInstalled?: boolean;
}

interface HermesRuntime {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, error: unknown) => void;
    onHandled: (id: number) => void;
  }) => void;
}

export function installDiagnostics(): void {
  const errorUtils = (globalThis as unknown as { ErrorUtils?: GlobalErrorUtils })
    .ErrorUtils;
  if (errorUtils && !errorUtils.__atlasDiagInstalled) {
    errorUtils.__atlasDiagInstalled = true;
    const original = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler?.((error, isFatal) => {
      try {
        diagError(error, isFatal ? "fatal" : "js");
      } catch {
        // Never mask the original error.
      }
      if (!isFatal && typeof original === "function") original(error, isFatal);
    });
  }

  const hermes = (globalThis as unknown as { HermesInternal?: HermesRuntime })
    .HermesInternal;
  try {
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, error) => {
        try {
          diagError(error, "unhandled");
        } catch {
          // Ignore recorder failures.
        }
      },
      onHandled: () => undefined,
    });
  } catch {
    // Hermes tracker is best-effort.
  }
}
