let running = 0;

/** Marks an AI generation as in flight so background preloads can wait. */
export function beginHeavyTask(): void {
  running += 1;
}

export function endHeavyTask(): void {
  running = Math.max(0, running - 1);
}

export function isHeavyTaskRunning(): boolean {
  return running > 0;
}
