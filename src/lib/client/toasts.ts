import { writable } from 'svelte/store';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

const { subscribe, update } = writable<ToastItem[]>([]);

function removeToast(id: string) {
  update((items) => items.filter((item) => item.id !== id));
}

export function pushToast(
  message: string,
  tone: ToastTone = 'info',
  durationMs = tone === 'error' ? 5200 : 3200
) {
  const id = crypto.randomUUID();
  update((items) => [...items, { id, message, tone }]);

  if (durationMs > 0) {
    setTimeout(() => removeToast(id), durationMs);
  }

  return id;
}

export const toasts = {
  subscribe,
  remove: removeToast
};
