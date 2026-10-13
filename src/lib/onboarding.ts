import { STORAGE_KEYS, readString, writeString } from './storage';

export async function hasOnboarded(): Promise<boolean> {
  return (await readString(STORAGE_KEYS.onboarded)) === 'true';
}

export async function setOnboarded(value = true): Promise<void> {
  await writeString(STORAGE_KEYS.onboarded, value ? 'true' : 'false');
}
