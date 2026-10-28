import { InteractionManager } from "react-native";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const pendingFlush = new Map<string, ReturnType<typeof setTimeout>>();

export const PROFILE_CHANGED_EVENT = "atlas:profile-changed";
export const COURSES_CHANGED_EVENT = "atlas:courses-changed";
export const FOCUS_CHANGED_EVENT = "atlas:focus-changed";
export const ROADMAPS_CHANGED_EVENT = "atlas:roadmaps-changed";
export const FRIENDS_CHANGED_EVENT = "atlas:friends-changed";
export const NOTES_CHANGED_EVENT = "atlas:notes-changed";
export const LEADERBOARD_CHANGED_EVENT = "atlas:leaderboard-changed";

/** Bursts inside this window reach listeners once. */
export const EVENT_COALESCE_MS = 250;

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
  if (pendingFlush.has(event)) return;
  const timer = setTimeout(() => {
    pendingFlush.delete(event);
    InteractionManager.runAfterInteractions(() => {
      listeners.get(event)?.forEach((listener) => listener());
    });
  }, EVENT_COALESCE_MS);
  pendingFlush.set(event, timer);
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

export function notifyFriendsChanged(): void {
  emit(FRIENDS_CHANGED_EVENT);
}

export function notifyNotesChanged(): void {
  emit(NOTES_CHANGED_EVENT);
}

export function notifyLeaderboardChanged(): void {
  emit(LEADERBOARD_CHANGED_EVENT);
}
