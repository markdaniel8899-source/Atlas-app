type Listener = (disabled: boolean) => void;

const DISABLED_MESSAGE_RE =
  /banned|account[^.]{0,20}disabled|user[^.]{0,20}disabled|suspended|deactivated/i;

const listeners = new Set<Listener>();
let disabled = false;

/** True when GoTrue or the API reported a disabled / banned account. */
export function isDisabledAccountMessage(message: string | null | undefined) {
  return Boolean(message && DISABLED_MESSAGE_RE.test(message));
}

export function isAccountDisabled(): boolean {
  return disabled;
}

/**
 * Flags the signed-in account as disabled. The root overlay subscribes to
 * this, clears the local session and takes over the screen.
 */
export function markAccountDisabled(): void {
  if (disabled) return;
  disabled = true;
  for (const listener of listeners) {
    try {
      listener(true);
    } catch {
      // A broken subscriber must not block the guard.
    }
  }
}

/** Dismisses the guard so the user can sign in or contact support. */
export function resetAccountGuard(): void {
  if (!disabled) return;
  disabled = false;
  for (const listener of listeners) {
    try {
      listener(false);
    } catch {
      // Ignore subscriber failures.
    }
  }
}

export function subscribeAccountDisabled(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
