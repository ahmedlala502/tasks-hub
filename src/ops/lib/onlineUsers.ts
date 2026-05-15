import type { OpsOffice, OpsUser } from '../auth/types';
import type { Handover, Task } from '../types';

export type OnlineUserStatus = 'online' | 'idle' | 'inactive';

export interface OnlineUserRow {
  name: string;
  email?: string;
  role?: OpsUser['role'];
  office?: OpsOffice;
  city?: string;
  department?: string;
  title?: string;
  shift?: string;
  roleTask?: string;
  rosterStatus?: 'scheduled' | 'off' | 'leave' | 'unscheduled';
  todaySchedule?: string;
  nextShiftDate?: string;
  nextShiftTime?: string;
  rosterSource?: string;
  credentialEmail?: string;
  status: OnlineUserStatus;
  lastActiveAt?: number;
  tasksTouched: number;
  handoversTouched: number;
  source: 'cloud' | 'workspace' | 'roster';
}

export interface EmployeeRosterEntry {
  name: string;
  city: string;
  office: OpsOffice;
  department: string;
  roleTask: string;
  shift: string;
  source: string;
  schedule: Record<string, string>;
}

interface BuildOnlineUserRosterInput {
  users?: OpsUser[];
  roster?: EmployeeRosterEntry[];
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

function emailPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function getRosterCredentialEmail(name: string) {
  const parts = normalizeName(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'user@trygc.com';
  if (parts.length === 1) return `${emailPart(parts[0])}@trygc.com`;
  return `${emailPart(parts[0][0] || '')}.${emailPart(parts[1])}@trygc.com`;
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

function cairoDateKey(now: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

function rosterStatus(value?: string): NonNullable<OnlineUserRow['rosterStatus']> {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'unscheduled';
  if (normalized === 'off') return 'off';
  if (normalized.includes('leave') || normalized.includes('absent')) return 'leave';
  return 'scheduled';
}

function nextScheduledShift(schedule: Record<string, string>, todayKey: string) {
  return Object.entries(schedule)
    .filter(([date, value]) => date >= todayKey && rosterStatus(value) === 'scheduled')
    .sort(([left], [right]) => left.localeCompare(right))[0];
}

export function buildOnlineUserRoster({
  users = [],
  roster = [],
  tasks,
  handovers,
  now = Date.now(),
  onlineWindowMs = DEFAULT_ONLINE_WINDOW_MS,
  idleWindowMs = DEFAULT_IDLE_WINDOW_MS,
}: BuildOnlineUserRosterInput): OnlineUserRow[] {
  const rows = new Map<string, OnlineUserRow>();
  const todayKey = cairoDateKey(now);

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

  roster.forEach((employee) => {
    const row = ensureRow(employee.name);
    if (!row) return;
    const todaySchedule = employee.schedule[todayKey] || '';
    const nextShift = nextScheduledShift(employee.schedule, todayKey);
    row.office = employee.office;
    row.city = employee.city;
    row.department = employee.department;
    row.title = employee.roleTask;
    row.roleTask = employee.roleTask;
    row.shift = employee.shift;
    row.todaySchedule = todaySchedule || 'No roster entry';
    row.rosterStatus = rosterStatus(todaySchedule);
    row.nextShiftDate = nextShift?.[0];
    row.nextShiftTime = nextShift?.[1];
    row.rosterSource = employee.source;
    row.credentialEmail = getRosterCredentialEmail(employee.name);
    row.source = 'roster';
  });

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
      row.source = row.source === 'roster' ? row.source : 'cloud';
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
    [handover.outgoingLead ?? '', handover.incomingLead ?? ''].forEach((name) => {
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
        || String(a.name || '').localeCompare(String(b.name || ''));
    });
}
