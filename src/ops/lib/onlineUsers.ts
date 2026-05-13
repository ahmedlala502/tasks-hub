import type { OpsOffice, OpsUser } from '../auth/types';
import type { Handover, Task } from '../types';

export type OnlineUserStatus = 'online' | 'idle' | 'inactive';

export interface OnlineUserRow {
  name: string;
  email?: string;
  role?: OpsUser['role'];
  office?: OpsOffice;
  department?: string;
  title?: string;
  status: OnlineUserStatus;
  lastActiveAt?: number;
  tasksTouched: number;
  handoversTouched: number;
  source: 'cloud' | 'workspace';
}

interface BuildOnlineUserRosterInput {
  users?: OpsUser[];
  tasks: Task[];
  handovers: Handover[];
  now?: number;
  onlineWindowMs?: number;
  idleWindowMs?: number;
}

const DEFAULT_ONLINE_WINDOW_MS = 1000 * 60 * 60 * 12;
const DEFAULT_IDLE_WINDOW_MS = 1000 * 60 * 60 * 48;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function keyFor(name: string): string {
  return normalizeName(name).toLowerCase();
}

function parseCloudTimestamp(value?: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function maxTimestamp(...values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return undefined;
  return Math.max(...valid);
}

function statusFor(lastActiveAt: number | undefined, now: number, onlineWindowMs: number, idleWindowMs: number): OnlineUserStatus {
  if (!lastActiveAt) return 'inactive';
  if (lastActiveAt >= now - onlineWindowMs) return 'online';
  if (lastActiveAt >= now - idleWindowMs) return 'idle';
  return 'inactive';
}

export function buildOnlineUserRoster({
  users = [],
  tasks,
  handovers,
  now = Date.now(),
  onlineWindowMs = DEFAULT_ONLINE_WINDOW_MS,
  idleWindowMs = DEFAULT_IDLE_WINDOW_MS,
}: BuildOnlineUserRosterInput): OnlineUserRow[] {
  const rows = new Map<string, OnlineUserRow>();

  const ensureRow = (name: string): OnlineUserRow | undefined => {
    const normalized = normalizeName(name);
    if (!normalized) return undefined;
    const key = keyFor(normalized);
    if (!rows.has(key)) {
      rows.set(key, {
        name: normalized,
        status: 'inactive',
        tasksTouched: 0,
        handoversTouched: 0,
        source: 'workspace',
      });
    }
    return rows.get(key);
  };

  users
    .filter((user) => user.status === 'active')
    .forEach((user) => {
      const row = ensureRow(user.displayName);
      if (!row) return;
      row.email = user.email;
      row.role = user.role;
      row.office = user.office;
      row.department = user.department;
      row.title = user.title;
      row.source = 'cloud';
      row.lastActiveAt = maxTimestamp(row.lastActiveAt, parseCloudTimestamp(user.lastSignInAt));
    });

  tasks.forEach((task) => {
    const row = ensureRow(task.ownerId);
    if (!row) return;
    row.tasksTouched += 1;
    row.lastActiveAt = maxTimestamp(row.lastActiveAt, task.completedAt, task.updatedAt, task.createdAt);
  });

  handovers.forEach((handover) => {
    const lastActiveAt = maxTimestamp(handover.reviewedAt, handover.acknowledgedAt, handover.updatedAt, handover.createdAt);
    [handover.outgoingLead, handover.incomingLead].forEach((name) => {
      const row = ensureRow(name);
      if (!row) return;
      row.handoversTouched += 1;
      row.lastActiveAt = maxTimestamp(row.lastActiveAt, lastActiveAt);
    });
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      status: statusFor(row.lastActiveAt, now, onlineWindowMs, idleWindowMs),
    }))
    .sort((a, b) => {
      const statusRank: Record<OnlineUserStatus, number> = { online: 0, idle: 1, inactive: 2 };
      return statusRank[a.status] - statusRank[b.status]
        || (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)
        || a.name.localeCompare(b.name);
    });
}
