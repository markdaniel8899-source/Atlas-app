import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedAuthUser } from "./auth";

/**
 * Local fallback for the notes list order. `notes.sort_order` is the source
 * of truth, but a reorder made offline must still stick and must sync the
 * next time the list loads with a connection.
 */
const PREFIX = "atlas.note.order.v1";

function storageKey(): string {
  return `${PREFIX}:${getCachedAuthUser()?.id ?? "guest"}`;
}

export async function readNoteOrder(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey());
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function writeNoteOrder(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(), JSON.stringify(ids));
  } catch {
    // Storage failure only loses the local fallback - DB order still applies.
  }
}

/** Apply a saved order, keeping unknown (new) notes after the known ones. */
export function applyNoteOrder<T extends { id: string }>(
  rows: T[],
  order: string[],
): T[] {
  if (order.length === 0) return rows;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => {
    const aRank = rank.get(a.id);
    const bRank = rank.get(b.id);
    if (aRank != null && bRank != null) return aRank - bRank;
    if (aRank != null) return -1;
    if (bRank != null) return 1;
    return 0;
  });
}
