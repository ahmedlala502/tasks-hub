import { AuthState, Handover, Member, Office, PendingSignupRequest, Priority, Shift, Status, Task, User, WorkspaceUser } from '../types';
import { INITIAL_HANDOVERS, INITIAL_MEMBERS, INITIAL_TASKS, INITIAL_USER, MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD, OFFICES, TEAMS } from '../constants';
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_WIDGET_CONFIG, RolePermissionMap, WidgetConfig } from './accessControl';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
}

export interface WorkspaceSettings {
  name: string;
  sla: number;
  teams: string[];
  locations: string[];
  autoBridge?: boolean;
  authMode?: 'local' | 'none';
  minPasscodeLength?: number;
  sessionLockMinutes?: number;
  aiProvider?: string;
  aiModel?: string;
  aiEndpoint?: string;
  apiKeyHint?: string;
  providerModels?: Record<string, string>;
  providerEndpoints?: Record<string, string>;
  mcpConfig?: string;
  customProviders?: CustomProvider[];
  featureFlags?: Record<string, boolean>;
  rolePermissions?: RolePermissionMap;
  widgetConfig?: WidgetConfig;
  fallbackProviders?: string[];
  appearance?: {
    fontSize: number;
    radius: number;
    density: 'compact' | 'comfortable';
  };
}

export interface AuditEvent {
  id: string;
  action: string;
  details: unknown;
  timestamp: string;
  userId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface LocalWorkspace {
  user: User;
  users: WorkspaceUser[];
  pendingSignups: PendingSignupRequest[];
  tasks: Task[];
  handovers: Handover[];
  offices: Office[];
  members: Member[];
  settings: WorkspaceSettings;
  auditLogs: AuditEvent[];
}

// Separate localStorage keys to prevent data collision
const STORE_KEYS = {
  workspace: 'trygc_hub_workspace_v7',   // bumped: clears all demo data
  auth: 'trygc_hub_auth_v2',
  settings: 'trygc_hub_settings_v2',
  draft: 'trygc_hub_drafts_v1',
  cache: 'trygc_hub_cache_v1',
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaves = 0;

export function saveWorkspace(workspace: LocalWorkspace) {
  if (saveTimer) clearTimeout(saveTimer);
  pendingSaves++;
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEYS.workspace, JSON.stringify(workspace));
      pendingSaves = 0;
    } catch (e) {
      console.warn('Failed to save workspace to localStorage:', e);
      // Try to save minimal version if storage is full
      try {
        const minimal = {
          ...workspace,
          auditLogs: workspace.auditLogs.slice(0, 50),
        };
        localStorage.setItem(STORE_KEYS.workspace, JSON.stringify(minimal));
      } catch {
        console.error('Critical: Unable to save workspace data');
      }
    }
  }, 300);
}

export function flushWorkspace() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingSaves = 0;
}

export function hasPendingSaves(): boolean {
  return pendingSaves > 0;
}

export function getAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(STORE_KEYS.auth);
    if (!raw) return { isAuthenticated: false, isLocked: false, lastActivity: 0 };
    const parsed = JSON.parse(raw) as AuthState;
    // Validate session expiration
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearAuthState();
      return { isAuthenticated: false, isLocked: false, lastActivity: 0 };
    }
    return parsed;
  } catch {
    return { isAuthenticated: false, isLocked: false, lastActivity: 0 };
  }
}

export function saveAuthState(state: AuthState): void {
  try {
    localStorage.setItem(STORE_KEYS.auth, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save auth state:', e);
  }
}

export function clearAuthState(): void {
  localStorage.removeItem(STORE_KEYS.auth);
}

export function getSettings(): WorkspaceSettings | null {
  try {
    const raw = localStorage.getItem(STORE_KEYS.settings);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSettings;
  } catch {
    return null;
  }
}

export function saveSettings(settings: WorkspaceSettings): void {
  try {
    localStorage.setItem(STORE_KEYS.settings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

export function clearAllData(): void {
  Object.values(STORE_KEYS).forEach(key => localStorage.removeItem(key));
}

function buildUserFromMember(member: Member): WorkspaceUser {
  const now = new Date().toISOString();
  const emailBase = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return {
    id: createId('user'),
    name: member.name,
    role: member.role || 'Viewer',
    office: member.office,
    country: member.country,
    email: `${emailBase || 'user'}@trygc.local`,
    password: '',
    team: member.team,
    status: 'active',
    createdAt: now,
  };
}

function buildMasterAccount(): WorkspaceUser {
  const now = new Date().toISOString();
  return {
    id: 'user-master',
    name: INITIAL_USER.name,
    role: 'Super Admin',
    office: INITIAL_USER.office,
    country: INITIAL_USER.country,
    email: MASTER_ADMIN_EMAIL,
    password: MASTER_ADMIN_PASSWORD,
    team: INITIAL_MEMBERS.find(member => member.name === INITIAL_USER.name)?.team || TEAMS[0],
    status: 'active',
    createdAt: now,
    approvedAt: now,
    isSuperAdmin: true,
    lastLoginAt: now,
  };
}

function migrateMasterUser(user: User, users: WorkspaceUser[]): User {
  const masterUser = users.find(u => u.email?.toLowerCase() === MASTER_ADMIN_EMAIL);
  if (masterUser) {
    return {
      ...user,
      email: masterUser.email,
      password: masterUser.password,
      isSuperAdmin: true,
      role: 'Super Admin',
    };
  }
  return user;
}

function migrateWorkspaceUsers(users?: WorkspaceUser[], members?: Member[]): WorkspaceUser[] {
  const seededUsers: WorkspaceUser[] = (users || [])
    .filter(Boolean)
    .map(user => ({
      ...user,
      role: user.role || 'Viewer',
      office: user.office || INITIAL_USER.office,
      country: user.country || INITIAL_USER.country,
      team: user.team || (members && members.find(m => m.name === user.name)?.team) || TEAMS[0],
      status: (user.status || 'active') as 'active' | 'inactive' | 'suspended',
      createdAt: user.createdAt || new Date().toISOString(),
      approvedAt: user.approvedAt || user.createdAt || new Date().toISOString(),
      isSuperAdmin: user.email?.toLowerCase() === MASTER_ADMIN_EMAIL ? true : user.isSuperAdmin || false,
      password: user.password || '',
    }));

  const masterAccount = buildMasterAccount();
  const masterIndex = seededUsers.findIndex(user => user.email?.toLowerCase() === MASTER_ADMIN_EMAIL);

  if (masterIndex >= 0) {
    seededUsers[masterIndex] = { ...seededUsers[masterIndex], ...masterAccount, password: seededUsers[masterIndex].password };
  } else {
    seededUsers.unshift(masterAccount);
  }

  return seededUsers;
}

function migratePendingSignups(pendingSignups?: PendingSignupRequest[]): PendingSignupRequest[] {
  return (pendingSignups || []).filter(Boolean).map(request => ({
    ...request,
    requestedAt: request.requestedAt || new Date().toISOString(),
    team: request.team || TEAMS[0],
    office: request.office || INITIAL_USER.office,
    country: request.country || INITIAL_USER.country,
    approvedAt: request.approvedAt || undefined,
    approvedBy: request.approvedBy || undefined,
  }));
}

function migrateSettings(settings: Partial<WorkspaceSettings>): WorkspaceSettings {
  const existingTeams = settings.teams?.some(team => team === 'Operations Team' || team === 'Community Team')
    ? settings.teams
    : TEAMS;

  return {
    ...settings,
    name: settings.name || 'TryGC Hub Manager',
    sla: settings.sla ?? 30,
    teams: existingTeams,
    locations: settings.locations || ['Cairo', 'Riyadh', 'Dubai', 'Kuwait'],
    autoBridge: settings.autoBridge ?? true,
    authMode: settings.authMode === 'none' ? 'none' : 'local',
    minPasscodeLength: settings.minPasscodeLength ?? 6,
    sessionLockMinutes: settings.sessionLockMinutes ?? 60,
    aiProvider: settings.aiProvider || 'openai',
    aiModel: settings.aiModel || 'gpt-4o-mini',
    aiEndpoint: settings.aiEndpoint || '',
    apiKeyHint: settings.apiKeyHint || 'Set OPENAI_API_KEY in your local environment when AI calls are needed.',
    featureFlags: {
      autoRiskFlagging: settings.featureFlags?.autoRiskFlagging ?? true,
      carryOverThreshold: settings.featureFlags?.carryOverThreshold ?? true,
      officeIsolation: settings.featureFlags?.officeIsolation ?? true,
      teamIsolation: settings.featureFlags?.teamIsolation ?? true,
      shiftOverlapBuffer: settings.featureFlags?.shiftOverlapBuffer ?? true,
      aiBriefGeneration: settings.featureFlags?.aiBriefGeneration ?? true,
      localBackups: settings.featureFlags?.localBackups ?? true,
      darkMode: settings.featureFlags?.darkMode ?? false,
      realtimeSync: settings.featureFlags?.realtimeSync ?? false,
      notifications: settings.featureFlags?.notifications ?? true,
    },
    rolePermissions: settings.rolePermissions || DEFAULT_ROLE_PERMISSIONS,
    widgetConfig: { ...DEFAULT_WIDGET_CONFIG, ...(settings.widgetConfig || {}) },
    fallbackProviders: settings.fallbackProviders?.length ? settings.fallbackProviders : ['local', 'openai', 'anthropic', 'groq'],
    appearance: {
      fontSize: settings.appearance?.fontSize ?? 14,
      radius: settings.appearance?.radius ?? 24,
      density: settings.appearance?.density ?? 'comfortable',
    },
  } as WorkspaceSettings;
}

function migrateTasks(tasks?: Task[]): Task[] {
  if (!tasks) return [];
  return tasks.map(task => ({
    ...task,
    reminders: task.reminders?.map((r, i) => ({
      id: typeof r === 'object' && 'id' in r ? r.id : `rem-${i}`,
      time: typeof r === 'object' ? r.time : r,
      triggered: typeof r === 'object' ? r.triggered : false,
      label: typeof r === 'object' ? r.label : undefined,
    })) || [],
    tags: task.tags || [],
    due: task.due || new Date().toISOString(),
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    carry: task.carry ?? false,
    status: task.status || Status.BACKLOG,
    priority: task.priority || Priority.MEDIUM,
  }));
}

function migrateHandovers(handovers?: Handover[]): Handover[] {
  if (!handovers) return [];
  return handovers.map(h => ({
    ...h,
    createdAt: h.createdAt || new Date().toISOString(),
    taskIds: h.taskIds || [],
    reviewHistory: h.reviewHistory || [],
    issues: h.issues || [],
  }));
}

export function importWorkspace(jsonData: string): LocalWorkspace | null {
  try {
    const data = JSON.parse(jsonData) as Partial<LocalWorkspace>;
    if (!data.tasks && !data.members && !data.offices) return null;

    const seed = createWorkspace();
    const members = data.members?.length ? data.members : seed.members;
    const users = migrateWorkspaceUsers(data.users, members);

    return {
      user: migrateMasterUser(data.user || seed.user, users),
      users,
      pendingSignups: migratePendingSignups(data.pendingSignups),
      tasks: migrateTasks(data.tasks),
      handovers: migrateHandovers(data.handovers),
      offices: data.offices || [],
      members,
      settings: migrateSettings({ ...seed.settings, ...(data.settings || {}) }),
      auditLogs: (data.auditLogs || []).slice(0, 200),
    };
  } catch {
    return null;
  }
}

export function createWorkspace(): LocalWorkspace {
  const seededUsers = [
    buildMasterAccount(),
    ...INITIAL_MEMBERS
      .filter(member => member.name !== INITIAL_USER.name)
      .map(buildUserFromMember),
  ];

  return {
    user: INITIAL_USER,
    users: seededUsers,
    pendingSignups: [],
    tasks: INITIAL_TASKS,
    handovers: INITIAL_HANDOVERS,
    offices: OFFICES,
    members: INITIAL_MEMBERS,
    settings: migrateSettings({}),
    auditLogs: [],
  };
}

export function loadWorkspace(): LocalWorkspace {
  try {
    // Silently clear stale v5 key if still present
    localStorage.removeItem('trygc_hub_workspace_v5');

    const raw = localStorage.getItem(STORE_KEYS.workspace);
    if (!raw) return createWorkspace();

    const parsed = JSON.parse(raw) as Partial<LocalWorkspace>;
    const seed = createWorkspace();
    const members = parsed.members?.length ? parsed.members : seed.members;
    const users = migrateWorkspaceUsers(parsed.users, members);

    const cleanTasks = migrateTasks(parsed.tasks);
    const cleanHandovers = migrateHandovers(parsed.handovers);
    const cleanMembers = members;
    const cleanOffices = parsed.offices?.length ? parsed.offices : seed.offices;

    return {
      user: migrateMasterUser(parsed.user || seed.user, users),
      users,
      pendingSignups: migratePendingSignups(parsed.pendingSignups),
      tasks: cleanTasks,
      handovers: cleanHandovers,
      offices: cleanOffices,
      members: cleanMembers,
      settings: migrateSettings({ ...seed.settings, ...(parsed.settings || {}) }),
      auditLogs: (parsed.auditLogs || []).slice(0, 200),
    };
  } catch {
    return createWorkspace();
  }
}

export function resetWorkspace() {
  const workspace = createWorkspace();
  flushWorkspace();
  try {
    localStorage.setItem(STORE_KEYS.workspace, JSON.stringify(workspace));
  } catch (e) {
    console.error('Failed to reset workspace:', e);
  }
  return workspace;
}

export function createId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${timestamp}-${random}`;
}

export function normalizeTask(task: Partial<Task>, user: User): Task {
  const now = new Date().toISOString();
  return {
    id: task.id || createId('task'),
    title: task.title?.trim() || 'Untitled task',
    country: task.country || user.country || 'EG',
    office: task.office || user.office || 'Cairo HQ',
    team: task.team || user.team || TEAMS[0],
    owner: task.owner || user.name || 'Unassigned',
    shift: task.shift || Shift.MORNING,
    priority: task.priority || Priority.MEDIUM,
    status: task.status || Status.BACKLOG,
    due: task.due || now,
    campaign: task.campaign?.trim() || '',
    details: task.details?.trim() || '',
    carry: task.carry || false,
    dod: task.dod || [],
    reminders: (task.reminders || []).map((r, i) => ({
      id: typeof r === 'object' && 'id' in r ? r.id : `rem-${i}`,
      time: typeof r === 'object' ? r.time : r,
      triggered: typeof r === 'object' ? r.triggered : false,
      label: typeof r === 'object' ? r.label : undefined,
    })),
    createdAt: task.createdAt || now,
    updatedAt: now,
    creatorId: task.creatorId || user.email || 'local-workspace',
    dependencies: task.dependencies || [],
    tags: task.tags || [],
    estimatedHours: task.estimatedHours,
    actualHours: task.actualHours,
    blockedReason: task.blockedReason,
    blockedSince: task.blockedSince,
  };
}

export function exportWorkspaceAsJSON(workspace: LocalWorkspace): string {
  return JSON.stringify(workspace, null, 2);
}

export function getStorageUsage(): { used: number; total: number; percentage: number } {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      used += localStorage.getItem(key)?.length || 0;
    }
  }
  // Approximate limit of 5MB for localStorage
  const total = 5 * 1024 * 1024;
  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
  };
}
