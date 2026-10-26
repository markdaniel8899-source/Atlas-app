type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let active = false;

/**
 * Marks a multi-step auth flow that creates a Supabase session mid-way.
 * Signup verification and password recovery both do this, but the root
 * navigator must keep the current route mounted until the flow finishes.
 * The root layout defers the session-key change while this flag is set.
 */
export function beginAuthDeferral(): void {
  if (active) return;
  active = true;
  for (const listener of listeners) {
    try {
      listener(true);
    } catch {
      // A broken subscriber must not block the flow.
    }
  }
}

export function endAuthDeferral(): void {
  if (!active) return;
  active = false;
  for (const listener of listeners) {
    try {
      listener(false);
    } catch {
      // Ignore subscriber failures.
    }
  }
}

export function isAuthDeferralActive(): boolean {
  return active;
}

export function subscribeAuthDeferral(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
