/**
 * In-app notification centre. Friend requests, accepted requests and shared
 * notes are pushed here by the realtime listener (and by the periodic sync in
 * notification-sync.ts). The bell in the app header renders the list and the
 * drawer shows live badges, mirroring the website.
 *
 * The store is framework-light (module state + subscriber set) so Supabase
 * callbacks can write to it without a provider.
 */
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerResetHandler } from "./session-reset";

export type NotificationKind =
  | "friend_request"
  | "friend_accepted"
  | "note_shared";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  detail?: string;
  /** App route opened when the row is tapped. */
  href: string;
  createdAt: number;
  read: boolean;
}

interface NotificationState {
  items: AppNotification[];
  /** Pending incoming friend requests (not unread notifications). */
  friendRequests: number;
}

const MAX_ITEMS = 40;
const STORAGE_PREFIX = "atlas.notifications.v1:";

let owner: string | null = null;
let state: NotificationState = { items: [], friendRequests: 0 };
const listeners = new Set<() => void>();
let loadToken = 0;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return (
    value === "friend_request" ||
    value === "friend_accepted" ||
    value === "note_shared"
  );
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.message === "string" &&
    typeof item.href === "string" &&
    item.href.startsWith("/") &&
    typeof item.createdAt === "number" &&
    Number.isFinite(item.createdAt) &&
    typeof item.read === "boolean" &&
    isNotificationKind(item.kind) &&
    (item.detail === undefined || typeof item.detail === "string")
  );
}

function sortItems(items: AppNotification[]): AppNotification[] {
  return [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ITEMS);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (!owner) return;
  void AsyncStorage.setItem(
    storageKey(owner),
    JSON.stringify(state.items),
  ).catch(() => {});
}

function commit(): void {
  persist();
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): NotificationState {
  return state;
}

async function loadItems(userId: string): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortItems(parsed.filter(isNotification));
  } catch {
    return [];
  }
}

/** Switches the store to the signed-in user's own persistent list. */
export function setNotificationOwner(userId: string | null): void {
  if (owner === userId) return;
  owner = userId;
  state = { items: [], friendRequests: 0 };
  notify();
  if (!userId) return;

  const token = (loadToken += 1);
  void loadItems(userId).then((stored) => {
    if (token !== loadToken || owner !== userId) return;
    // Anything pushed while the disk read was in flight wins; stored items
    // only fill the gaps.
    const existing = new Set(state.items.map((item) => item.id));
    state = {
      ...state,
      items: sortItems([
        ...state.items,
        ...stored.filter((item) => !existing.has(item.id)),
      ]),
    };
    notify();
  });
}

export function hasNotification(id: string): boolean {
  return state.items.some((item) => item.id === id);
}

export function pushNotification(item: {
  id: string;
  kind: NotificationKind;
  message: string;
  detail?: string;
  href: string;
  /** Server timestamp (ms). Defaults to now for live events. */
  createdAt?: number;
}): boolean {
  if (!owner) return false;
  if (state.items.some((entry) => entry.id === item.id)) return false;

  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const next: AppNotification = {
    id: item.id,
    kind: item.kind,
    message: item.message,
    detail: item.detail,
    href: item.href,
    createdAt,
    read: false,
  };
  state = { ...state, items: sortItems([next, ...state.items]) };
  commit();
  return true;
}

export function setFriendRequestCount(count: number): void {
  const next = Math.max(0, Math.floor(count));
  if (state.friendRequests === next) return;
  state = { ...state, friendRequests: next };
  notify();
}

export function markNotificationRead(id: string): void {
  if (!state.items.some((item) => item.id === id && !item.read)) return;
  state = {
    ...state,
    items: state.items.map((item) =>
      item.id === id ? { ...item, read: true } : item,
    ),
  };
  commit();
}

export function markAllNotificationsRead(): void {
  if (!state.items.some((item) => !item.read)) return;
  state = {
    ...state,
    items: state.items.map((item) => ({ ...item, read: true })),
  };
  commit();
}

/** Removes the persisted list for `userId` (or the active owner). */
export function clearNotificationStore(userId?: string | null): void {
  const target = userId ?? owner;
  if (target) {
    void AsyncStorage.removeItem(storageKey(target)).catch(() => {});
  }
  if (target === owner) {
    state = { items: [], friendRequests: 0 };
    notify();
  }
}

export function useNotifications(): NotificationState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useUnreadCount(): number {
  const current = useNotifications();
  let unread = 0;
  for (const item of current.items) {
    if (!item.read) unread += 1;
  }
  return unread;
}

export interface NotificationBadges {
  /** Pending incoming friend requests. */
  friends: number;
  /** Unread shared-note notifications. */
  notes: number;
  /** Every unread notification (bell badge). */
  unread: number;
}

export function useNotificationBadges(): NotificationBadges {
  const current = useNotifications();
  let notes = 0;
  let unread = 0;
  for (const item of current.items) {
    if (item.read) continue;
    unread += 1;
    if (item.kind === "note_shared") notes += 1;
  }
  return { friends: current.friendRequests, notes, unread };
}

// Account switch / sign-out: drop the in-memory list and the persisted copy so
// one account's notifications never reach the next viewer on this device.
registerResetHandler(() => {
  const previous = owner;
  owner = null;
  state = { items: [], friendRequests: 0 };
  if (previous) {
    void AsyncStorage.removeItem(storageKey(previous)).catch(() => {});
  }
  notify();
});
