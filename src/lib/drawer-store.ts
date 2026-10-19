/**
 * Global navigation-drawer state. One drawer is rendered above the tab
 * navigator (not per screen), so a section switch happens underneath the
 * sliding panel instead of the old screen flashing first.
 */

let visible = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function openDrawer(): void {
  if (visible) return;
  visible = true;
  emit();
}

export function closeDrawer(): void {
  if (!visible) return;
  visible = false;
  emit();
}

export function isDrawerOpen(): boolean {
  return visible;
}

export function subscribeDrawer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
