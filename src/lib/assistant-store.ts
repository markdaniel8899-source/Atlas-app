import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ask,
  classify,
  newTurnId,
  validate,
  type Turn,
} from "./assistant";

const STORAGE_KEY = "atlas.assistant.thread.v1";

/** Chats older than this are wiped automatically on the next launch. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface AssistantChatState {
  turns: Turn[];
  pending: boolean;
  error: string | null;
  lastSent: string | null;
}

const INITIAL: AssistantChatState = {
  turns: [],
  pending: false,
  error: null,
  lastSent: null,
};

/**
 * Module-level chat store: the request keeps running even when the screen
 * unmounts (tab switch / drawer navigation) and the thread survives remounts.
 * Persisted to AsyncStorage and auto-cleared after 24 hours.
 */
let state: AssistantChatState = INITIAL;
let snapshot: AssistantChatState = state;
/** Turns as they were before the in-flight user message was appended. */
let historyBase: Turn[] = [];
let hydrated = false;
/** Owner (user id) of the persisted thread - never shown across accounts. */
let persistedOwner: string | null = null;
let claimedOwner: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...state };
  for (const listener of listeners) listener();
}

function persist() {
  persistedOwner = claimedOwner ?? persistedOwner;
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      turns: state.turns,
      savedAt: Date.now(),
      ownerId: persistedOwner,
    }),
  ).catch(() => undefined);
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      turns?: unknown;
      savedAt?: unknown;
      ownerId?: unknown;
    };
    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) return;
    persistedOwner =
      typeof parsed.ownerId === "string" ? parsed.ownerId : null;
    if (claimedOwner && persistedOwner !== claimedOwner) {
      // Thread belongs to another account - drop it.
      persistedOwner = null;
      void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
      return;
    }
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (Date.now() - savedAt > MAX_AGE_MS) {
      void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
      return;
    }
    const turns = parsed.turns.filter(
      (turn): turn is Turn =>
        Boolean(turn) &&
        typeof turn === "object" &&
        typeof (turn as Turn).content === "string" &&
        ((turn as Turn).role === "user" ||
          (turn as Turn).role === "assistant"),
    );
    if (turns.length === 0) return;
    state = { ...state, turns };
    emit();
  } catch {
    // Corrupt payload - start fresh.
  }
}

/**
 * Tell the store who is signed in. A persisted thread from a different
 * account (or with no recorded owner) is discarded instead of leaking.
 */
export function claimAssistantChat(ownerId: string) {
  claimedOwner = ownerId;
  if (!hydrated) return;
  if (persistedOwner === ownerId) return;
  if (state.turns.length === 0) return;
  state = INITIAL;
  historyBase = [];
  persistedOwner = null;
  emit();
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function subscribeAssistantChat(listener: () => void): () => void {
  void hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAssistantChatSnapshot(): AssistantChatState {
  return snapshot;
}

async function runAsk(
  text: string,
  history: Turn[],
  systemPrompt: string | null,
  userName?: string,
) {
  try {
    const reply = await ask(text, history, systemPrompt, userName);
    state = {
      ...state,
      turns: [...state.turns, reply],
      pending: false,
      lastSent: null,
    };
    emit();
    persist();
  } catch (caught) {
    state = { ...state, pending: false, error: classify(caught), lastSent: text };
    emit();
  }
}

export async function sendAssistantMessage(
  text: string,
  systemPrompt: string | null,
  userName?: string,
) {
  const problem = validate(text);
  if (problem) {
    state = { ...state, error: problem };
    emit();
    return;
  }
  if (state.pending) return;

  const trimmed = text.trim();
  // The message itself travels separately, so history is everything before it.
  historyBase = state.turns;
  const userTurn: Turn = {
    id: newTurnId(),
    role: "user",
    content: trimmed,
  };
  state = {
    ...state,
    turns: [...state.turns, userTurn],
    pending: true,
    error: null,
  };
  emit();
  persist();
  await runAsk(trimmed, historyBase, systemPrompt, userName);
}

export async function retryAssistantMessage(
  systemPrompt: string | null,
  userName?: string,
) {
  const last = state.lastSent;
  if (!last || state.pending) return;
  state = { ...state, pending: true, error: null };
  emit();
  await runAsk(last, historyBase, systemPrompt, userName);
}

export function dismissAssistantError() {
  if (!state.error) return;
  state = { ...state, error: null };
  emit();
}

export function clearAssistantChat() {
  state = INITIAL;
  historyBase = [];
  persistedOwner = null;
  emit();
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}
