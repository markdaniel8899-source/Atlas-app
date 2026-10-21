/**
 * Tiny registry for per-account in-memory state. Feature stores register a
 * reset handler at module load; sign-out (or a user id change) runs them all
 * so nothing from the previous account survives into the next session.
 *
 * This module deliberately imports nothing, avoiding cycles with the stores
 * and with auth.ts.
 */

type ResetHandler = () => void;

const handlers = new Set<ResetHandler>();

export function registerResetHandler(handler: ResetHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function runResetHandlers(): void {
  for (const handler of handlers) {
    try {
      handler();
    } catch {
      // One failing store must not block the others.
    }
  }
}
