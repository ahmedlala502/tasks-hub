import type { OpsUser } from '../auth/types';
import { getOfficeFromProfile } from '../auth/types';
import type { Task } from '../types';

export type CompletedTaskCsvRow = {
  taskDescription: string;
  campaignName: string;
  priority: Task['priority'];
  name: string;
  status: string;
  deadline: string;
  note: string;
};

const IMPORTED_AT = new Date('2026-05-13T09:00:00Z').getTime();

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizePriority(value: string): Task['priority'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  return 'High';
}

function titleCaseToken(value: string): string {
  const lower = value.toLowerCase();
  if (['uae', 'ksa', 'kw'].includes(lower)) return lower.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function normalizeImportedUserName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.split('-').map(titleCaseToken).join('-'))
    .join(' ');
}

export function parseCompletedTasksCsv(raw: string): CompletedTaskCsvRow[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = lines.findIndex((line) => line.includes('TASK DESCRIPTION') && line.includes('NAME'));
  if (headerIndex === -1) return [];

  const headers = parseCsvLine(lines[headerIndex]).map(normalizeHeader);
  return lines.slice(headerIndex + 1).map((line) => {
    const cells = parseCsvLine(line);
    const get = (header: string) => cells[headers.indexOf(header)]?.trim() || '';

    return {
      taskDescription: get('task_description'),
      campaignName: get('campaign_name') || 'N/A',
      priority: normalizePriority(get('priority')),
      name: get('name'),
      status: get('status'),
      deadline: get('deadline'),
      note: get('note'),
    };
  }).filter((row) => row.taskDescription && row.name);
}

export function splitCompletedTaskOwners(name: string): string[] {
  return name
    .split(',')
    .map(normalizeImportedUserName)
    .filter(Boolean);
}

export function deriveUsersFromCompletedTasks(rows: CompletedTaskCsvRow[]): string[] {
  const names = new Set<string>();
  rows.forEach((row) => splitCompletedTaskOwners(row.name).forEach((name) => names.add(name)));
  return [...names].sort((a, b) => a.localeCompare(b));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function inferDepartment(row: CompletedTaskCsvRow): Task['department'] {
  const text = `${row.taskDescription} ${row.campaignName}`.toLowerCase();
  if (text.includes('coverage') || text.includes('missing')) return 'Coverage & Monitoring';
  if (text.includes('confirm') || text.includes('call') || text.includes('follow')) return 'WhatsApp / Live Chat';
  if (text.includes('list')) return 'Onboarding';
  if (text.includes('audit')) return 'Quality & Training';
  if (text.includes('dashboard') || text.includes('system')) return 'Systems & Automation';
  if (text.includes('report') || text.includes('booking')) return 'Account Managers';
  return 'Coordination';
}

function deadlineToTimestamp(deadline: string, fallback: number): number {
  if (!deadline) return fallback;
  const [hour, minute] = deadline.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  return new Date(2026, 4, 13, hour, minute, 0, 0).getTime();
}

export function buildImportedCompletedTasks(rows: CompletedTaskCsvRow[]): Task[] {
  return rows.flatMap((row, rowIndex) => {
    const owners = splitCompletedTaskOwners(row.name);
    return owners.map((owner, ownerIndex) => {
      const timestamp = IMPORTED_AT + (rowIndex * 1000) + ownerIndex;
      const dueDate = deadlineToTimestamp(row.deadline, timestamp);

      return {
        id: `CSV-DONE-${rowIndex + 1}-${ownerIndex + 1}-${slug(owner)}`,
        title: row.taskDescription,
        description: [
          `Imported from completed community CSV.`,
          `Status: ${row.status || 'Completed'}`,
          row.note ? `Note: ${row.note}` : '',
        ].filter(Boolean).join('\n'),
        ownerId: owner,
        dueDate,
        campaignId: row.campaignName || 'Imported Done Tasks',
        priority: row.priority,
        completed: true,
        completedAt: timestamp,
        department: inferDepartment(row),
        output: 'Completed historical task',
        kpi: 'Completed task ownership',
        scheduleLabel: row.deadline ? `Deadline ${row.deadline}` : 'Historical completion',
        flags: [
          { id: `csv-${rowIndex}-complete`, label: 'Imported completed', tone: 'green', resolved: true },
          { id: `csv-${rowIndex}-owner`, label: `Owner: ${owner}`, tone: 'green', resolved: true },
        ],
        reminders: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'community-done-csv',
      };
    });
  });
}

export function extractUsersFromWorkspaceExport(data: unknown): OpsUser[] {
  if (!data || typeof data !== 'object') return [];
  const maybeUsers = (data as { users?: unknown; members?: unknown }).users ?? (data as { members?: unknown }).members;
  if (!Array.isArray(maybeUsers)) return [];

  return maybeUsers
    .map((item): OpsUser | null => {
      if (!item || typeof item !== 'object') return null;
      const value = item as Record<string, unknown>;
      const email = String(value.email || '').trim().toLowerCase();
      const displayName = String(value.displayName || value.name || '').trim();
      if (!email || !displayName) return null;

      const role = value.role === 'master' || value.role === 'community' ? value.role : 'operations';

      return {
        uid: String(value.uid || value.id || email),
        email,
        displayName,
        role,
        status: value.status === 'suspended' ? 'suspended' : 'active',
        office: getOfficeFromProfile({ name: displayName, role, office: value.office || value.country }),
        department: 'Operations',
        title: 'Imported User',
        timezone: 'Africa/Cairo',
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
        lastSignInAt: typeof value.lastSignInAt === 'string' ? value.lastSignInAt : null,
      };
    })
    .filter((user): user is OpsUser => Boolean(user));
}
