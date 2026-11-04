/**
 * Tracks whether the current section switch came from the global drawer.
 * Drawer switches already have their own transition (the panel slides away
 * over a fading scrim), so the destination skips the content fade to avoid
 * a double transition. Direct jumps (cards, links, hardware back, auth
 * hand-offs) fade the incoming screen in instead of hard-cutting.
 */
let lastDrawerNavigationAt = 0;

/** Marks a section switch initiated by the global drawer. */
export function markDrawerNavigation(): void {
  lastDrawerNavigationAt = Date.now();
}

/**
 * Consumes a drawer mark that is still fresh. Returns false once the mark
 * has expired, so a missed focus can never suppress a later direct fade.
 */
export function consumeDrawerNavigation(windowMs = 600): boolean {
  if (Date.now() - lastDrawerNavigationAt >= windowMs) return false;
  lastDrawerNavigationAt = 0;
  return true;
}
