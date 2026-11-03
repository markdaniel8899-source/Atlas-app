import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Note } from "./notes";

/**
 * Persistent per-owner, per-scope notes list cache. Lets the Notes screen
 * paint the last fetched list on a cold offline start instead of showing an
 * empty list until the server responds.
 *
 * Key: atlas.notes.list.v1:<ownerId>:<scopeKey>
 *   scopeKey = "all" or "<courseId>"
 */

const PREFIX = "atlas.notes.list.v1";

function key(ownerId: string, scopeKey: string): string {
  return `${PREFIX}:${ownerId}:${scopeKey}`;
}

export async function readNotesCache(
  ownerId: string,
  scopeKey: string,
): Promise<Note[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key(ownerId, scopeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Note[];
  } catch {
    return null;
  }
}

export async function writeNotesCache(
  ownerId: string,
  scopeKey: string,
  notes: Note[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(ownerId, scopeKey), JSON.stringify(notes));
  } catch {
    // Best-effort cache only.
  }
}

export async function clearNotesCache(ownerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(ownerId, "all"));
  } catch {
    // Best-effort; course-scoped entries are overwritten on next fetch.
  }
}
