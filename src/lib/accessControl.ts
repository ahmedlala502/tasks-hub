import { Member, Task, Handover, Office, User } from '../types';

export const APP_PAGES = ['dashboard', 'reports', 'tasks', 'handover', 'offices', 'team', 'ai', 'settings', 'profile', 'activity'] as const;
export type AppPage = (typeof APP_PAGES)[number];

export const FEATURE_KEYS = [
  'task.create',
  'task.edit',
  'task.bulk',
  'task.delete',
  'handover.create',
  'handover.edit',
  'handover.ack',
  'handover.delete',
  'ai.use',
  'ai.configure',
  'settings.manage',
  'users.manage',
  'members.manage',
  'offices.manage',
  'widgets.manage',
  'export.data',
  'import.data',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const WIDGET_KEYS = [
  'workspaceHealth',
  'priorityQueue',
  'shiftTimeline',
  'operatingHubs',
  'taskBulkActions',
  'taskInsights',
  'handoverAudit',
  'aiQuickPrompts',
  'aiStudio',
  'aiProviderPanel',
  'memberStats',
  'officeMap',
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export interface RolePermissionProfile {
  pages: AppPage[];
  features: FeatureKey[];
  teams: string[];
  maxMembers?: number;
}

export type RolePermissionMap = Record<string, RolePermissionProfile>;
export type WidgetConfig = Record<WidgetKey, boolean>;

const ALL_PAGES = [...APP_PAGES];
const ALL_FEATURES = [...FEATURE_KEYS];
const ALL_WIDGETS = [...WIDGET_KEYS];

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  workspaceHealth: true,
  priorityQueue: true,
  shiftTimeline: true,
  operatingHubs: true,
  taskBulkActions: true,
  taskInsights: true,
  handoverAudit: true,
  aiQuickPrompts: true,
  aiStudio: true,
  aiProviderPanel: true,
  memberStats: true,
  officeMap: true,
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  'Super Admin': {
    pages: ALL_PAGES,
    features: ALL_FEATURES,
    teams: ['*'],
  },
  Master: {
    pages: ALL_PAGES,
    features: ALL_FEATURES,
    teams: ['*'],
  },
  Admin: {
    pages: ALL_PAGES,
    features: ALL_FEATURES.filter(f => !f.includes('configure') && f !== 'ai.configure'),
    teams: ['*'],
  },
  'Regional Manager': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'offices', 'team', 'ai', 'settings', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'task.delete', 'handover.create', 'handover.edit', 'handover.ack', 'handover.delete', 'ai.use', 'members.manage', 'offices.manage', 'export.data'],
    teams: ['*'],
  },
  'Country Manager': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'offices', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use', 'export.data'],
    teams: ['*'],
  },
  'Operations Lead': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use', 'export.data'],
    teams: ['Operations Team'],
  },
  'Operations Manager': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use'],
    teams: ['Operations Team'],
  },
  'Shift Lead': {
    pages: ['dashboard', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use'],
    teams: ['Operations Team'],
  },
  'Operations Agent': {
    pages: ['dashboard', 'tasks', 'handover', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'handover.create', 'handover.ack', 'ai.use'],
    teams: ['Operations Team'],
  },
  'Senior Operations Agent': {
    pages: ['dashboard', 'tasks', 'handover', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use'],
    teams: ['Operations Team'],
  },
  'Community Lead': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use', 'export.data'],
    teams: ['Community Team'],
  },
  'Community Manager': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use'],
    teams: ['Community Team'],
  },
  'Creator Coverage Lead': {
    pages: ['dashboard', 'tasks', 'handover', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use'],
    teams: ['Community Team'],
  },
  'Community Agent': {
    pages: ['dashboard', 'tasks', 'handover', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'handover.create', 'handover.ack', 'ai.use'],
    teams: ['Community Team'],
  },
  'QA Lead': {
    pages: ['dashboard', 'reports', 'tasks', 'handover', 'team', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'task.bulk', 'handover.create', 'handover.edit', 'handover.ack', 'ai.use', 'export.data'],
    teams: ['QA Team'],
  },
  'QA Agent': {
    pages: ['dashboard', 'tasks', 'handover', 'ai', 'profile'],
    features: ['task.create', 'task.edit', 'handover.create', 'handover.ack', 'ai.use'],
    teams: ['QA Team'],
  },
  Analyst: {
    pages: ['dashboard', 'reports', 'team', 'ai', 'profile'],
    features: ['ai.use', 'export.data'],
    teams: ['*'],
  },
  Viewer: {
    pages: ['dashboard', 'reports', 'team', 'profile'],
    features: [],
    teams: ['*'],
  },
};

function normalizeRoleName(role?: string): string {
  return (role || '').trim();
}

export function resolveRoleName(role?: string): string {
  const normalized = normalizeRoleName(role);
  if (DEFAULT_ROLE_PERMISSIONS[normalized]) return normalized;

  const lower = normalized.toLowerCase();
  if (lower.includes('super admin')) return 'Super Admin';
  if (lower.includes('community')) return lower.includes('lead') ? 'Community Lead' : lower.includes('manager') ? 'Community Manager' : lower.includes('creator') ? 'Creator Coverage Lead' : 'Community Agent';
  if (lower.includes('operation')) return lower.includes('lead') ? 'Operations Lead' : lower.includes('manager') ? 'Operations Manager' : 'Operations Agent';
  if (lower.includes('shift lead')) return 'Shift Lead';
  if (lower.includes('creator')) return 'Creator Coverage Lead';
  if (lower.includes('analyst') || lower.includes('report')) return 'Analyst';
  if (lower.includes('admin')) return 'Admin';
  if (lower.includes('manager')) return 'Country Manager';
  if (lower.includes('qa')) return lower.includes('lead') ? 'QA Lead' : 'QA Agent';
  return 'Viewer';
}

export function resolvePermissionProfile(role: string, overrides?: RolePermissionMap): RolePermissionProfile {
  const resolvedRole = resolveRoleName(role);
  return overrides?.[resolvedRole] || DEFAULT_ROLE_PERMISSIONS[resolvedRole] || DEFAULT_ROLE_PERMISSIONS.Viewer;
}

export function mergeWidgetConfig(overrides?: Partial<WidgetConfig>): WidgetConfig {
  return { ...DEFAULT_WIDGET_CONFIG, ...(overrides || {}) };
}

export function getCurrentMember(user: User, members: Member[]): Member | undefined {
  return members.find(member => member.name === user.name || member.role === user.role);
}

export function getCurrentTeam(user: User, members: Member[]): string {
  const member = getCurrentMember(user, members);
  if (member?.team) return member.team;
  if (user.team) return user.team;
  return user.role.toLowerCase().includes('community') || user.role.toLowerCase().includes('creator')
    ? 'Community Team'
    : user.role.toLowerCase().includes('qa')
      ? 'QA Team'
      : 'Operations Team';
}

function canSeeTeam(team: string | undefined, allowedTeams: string[]): boolean {
  if (!team) return true;
  if (allowedTeams.includes('*')) return true;
  return allowedTeams.includes(team);
}

export function filterTasksByTeam(tasks: Task[], allowedTeams: string[], teamIsolation: boolean): Task[] {
  if (!teamIsolation || allowedTeams.includes('*')) return tasks;
  return tasks.filter(task => canSeeTeam(task.team, allowedTeams));
}

export function filterHandoversByTeam(handovers: Handover[], allowedTeams: string[], teamIsolation: boolean): Handover[] {
  if (!teamIsolation || allowedTeams.includes('*')) return handovers;
  return handovers.filter(handover => canSeeTeam(handover.team, allowedTeams));
}

export function filterMembersByTeam(members: Member[], allowedTeams: string[], teamIsolation: boolean): Member[] {
  if (!teamIsolation || allowedTeams.includes('*')) return members;
  return members.filter(member => canSeeTeam(member.team, allowedTeams));
}

export function filterOfficesByTeam(offices: Office[], tasks: Task[], members: Member[], allowedTeams: string[], teamIsolation: boolean): Office[] {
  if (!teamIsolation || allowedTeams.includes('*')) return offices;
  const officeNames = new Set([
    ...filterTasksByTeam(tasks, allowedTeams, true).map(task => task.office),
    ...filterMembersByTeam(members, allowedTeams, true).map(member => member.office),
  ]);
  return offices.filter(office => officeNames.has(office.name));
}
