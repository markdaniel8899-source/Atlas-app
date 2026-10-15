type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export const PROFILE_CHANGED_EVENT = "atlas:profile-changed";
export const COURSES_CHANGED_EVENT = "atlas:courses-changed";
export const FOCUS_CHANGED_EVENT = "atlas:focus-changed";
export const ROADMAPS_CHANGED_EVENT = "atlas:roadmaps-changed";

export function listen(event: string, listener: Listener): () => void {
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

function emit(event: string): void {
  listeners.get(event)?.forEach((listener) => listener());
}

export function notifyProfileChanged(): void {
  emit(PROFILE_CHANGED_EVENT);
}

export function notifyCoursesChanged(): void {
  emit(COURSES_CHANGED_EVENT);
}

export function notifyFocusChanged(): void {
  emit(FOCUS_CHANGED_EVENT);
}

export function notifyRoadmapsChanged(): void {
  emit(ROADMAPS_CHANGED_EVENT);
}
