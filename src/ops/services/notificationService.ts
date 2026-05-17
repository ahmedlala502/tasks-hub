/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NotificationTone = 'orange' | 'red' | 'purple' | 'green';

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  tone: NotificationTone;
  path: string;
  createdAt: number;
  read: boolean;
}

const KEY = 'GC_NOTIFICATIONS';
const MAX = 50;

const load = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = (items: AppNotification[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
};

export const notificationService = {
  getAll: (): AppNotification[] => load(),

  add: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification => {
    const items = load();
    const entry: AppNotification = {
      ...n,
      id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      read: false,
    };
    const updated = [entry, ...items].slice(0, MAX);
    save(updated);
    window.dispatchEvent(new CustomEvent('gc-notification', { detail: entry }));
    return entry;
  },

  markAllRead: () => {
    const items = load().map(n => ({ ...n, read: true }));
    save(items);
  },

  clearAll: () => save([]),
};

export const notify = (
  title: string,
  detail: string,
  tone: NotificationTone,
  path: string
): void => {
  notificationService.add({ title, detail, tone, path });
};
