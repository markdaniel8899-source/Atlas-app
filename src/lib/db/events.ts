type Listener = () => void;

export const PROFILE_CHANGED_EVENT = 'atlas:profile-changed';
export const COURSES_CHANGED_EVENT = 'atlas:courses-changed';
export const FOCUS_CHANGED_EVENT = 'atlas:focus-changed';
export const ROADMAPS_CHANGED_EVENT = 'atlas:roadmaps-changed';

const listeners = new Map<string, Set<Listener>>();

export function subscribe(event: string, listener: Listener): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function notify(event: string): void {
  listeners.get(event)?.forEach((listener) => listener());
}

export function notifyProfileChanged(): void {
  notify(PROFILE_CHANGED_EVENT);
}

export function notifyCoursesChanged(): void {
  notify(COURSES_CHANGED_EVENT);
}

export function notifyFocusChanged(): void {
  notify(FOCUS_CHANGED_EVENT);
}

export function notifyRoadmapsChanged(): void {
  notify(ROADMAPS_CHANGED_EVENT);
}
