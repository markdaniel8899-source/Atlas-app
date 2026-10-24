type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let active = false;

/**
 * Marks the password-recovery flow as active. Verifying the recovery OTP
 * creates a Supabase session, but the root navigator must keep the current
 * route mounted until the new password is saved. The root layout defers the
 * session-key change while this flag is set.
 */
export function beginPasswordRecovery(): void {
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

export function endPasswordRecovery(): void {
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

export function isPasswordRecoveryActive(): boolean {
  return active;
}

export function subscribePasswordRecovery(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
