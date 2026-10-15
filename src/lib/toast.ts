export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
  duration: number;
}

export interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 3600;
const MAX_VISIBLE = 3;

const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  const snapshot = toasts;
  for (const listener of listeners) listener(snapshot);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function toast({ title, message, tone = 'info', duration }: ToastInput) {
  const id = nextId;
  nextId += 1;
  const item: ToastItem = {
    id,
    title,
    message,
    tone,
    duration: duration ?? DEFAULT_DURATION,
  };
  toasts = [...toasts, item].slice(-MAX_VISIBLE);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), item.duration),
  );
  emit();
  return id;
}

export function toastSuccess(title: string, message?: string) {
  return toast({ title, message, tone: 'success' });
}

export function toastError(title: string, message?: string) {
  return toast({ title, message, tone: 'error' });
}

export function toastInfo(title: string, message?: string) {
  return toast({ title, message, tone: 'info' });
}

export function clearToasts() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  toasts = [];
  emit();
}
