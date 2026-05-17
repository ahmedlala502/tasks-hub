export enum Status {
  BACKLOG = 'Backlog',
  IN_PROGRESS = 'In Progress',
  WAITING = 'Waiting',
  BLOCKED = 'Blocked',
  DONE = 'Done',
}

export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum Shift {
  MORNING = 'Morning',
  MID = 'Mid',
  NIGHT = 'Night',
}

export enum ThemeMode {
  FLOW = 'flow',
  TECH = 'tech',
  MINIMAL = 'minimal',
}

export interface Reminder {
  id: string;
  time: string;
  triggered: boolean;
  label?: string;
}

export interface PerformanceMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksBlocked: number;
  handoversOut: number;
  handoversAcknowledged: number;
  onTimeRate: number;
  qualityScore: number;
  avgCompletionTime: number;
  lastActivityDate?: string;
  thisMonthCompleted?: number;
  lastMonthCompleted?: number;
}

export interface UserPreferences {
  notifications?: boolean;
  emailDigest?: 'daily' | 'weekly' | 'never';
  theme?: ThemeMode;
  timezone?: string;
  language?: string;
  remindersEnabled?: boolean;
  reminderTime?: string;
  sidebarCollapsed?: boolean;
  density?: 'compact' | 'comfortable';
}

export interface UserProfile {
  id: string;
  bio?: string;
  avatar?: string;
  skills?: string[];
  specializations?: string[];
  yearsOfExperience?: number;
  joinDate: string;
  lastLoginDate?: string;
  preferences: UserPreferences;
  metrics: PerformanceMetrics;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  country: string;
  office: string;
  team: string;
  owner: string;
  shift: Shift;
  priority: Priority;
  status: Status;
  due: string;
  campaign?: string;
  details?: string;
  carry: boolean;
  dod?: string[];
  reminders?: Reminder[];
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  completedAt?: string;
  completedBy?: string;
  dependencies?: string[];
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  blockedReason?: string;
  blockedSince?: string;
  syncedAt?: string;
  localOnly?: boolean;
}

export interface Handover {
  id: string;
  date: string;
  fromShift: Shift;
  toShift: Shift;
  fromOffice: string;
  toOffice: string;
  team?: string;
  country?: string;
  outgoing: string;
  incoming: string;
  status: 'Pending' | 'Acknowledged';
  watchouts?: string;
  taskIds: string[];
  createdAt: string;
  ackAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  reviewHistory?: HandoverReviewEntry[];
  creatorId: string;
  templateId?: string;
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  issues?: string[];
  syncedAt?: string;
  localOnly?: boolean;
}

export interface HandoverReviewEntry {
  id: string;
  reviewer: string;
  reviewedAt: string;
  comment: string;
  action: 'Reviewed' | 'Acknowledged';
}

export interface HandoverTemplate {
  id: string;
  name: string;
  description?: string;
  team: string;
  fromShift: Shift;
  toShift: Shift;
  defaultTasks?: string[];
  defaultWatchouts?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Office {
  id: string;
  name: string;
  country: string;
  lead: string;
  shift: Shift;
  teamCapacity?: number;
  currentLoad?: number;
  timezone?: string;
  address?: string;
  phone?: string;
}

export interface Member {
  id: string;
  name: string;
  team: string;
  office: string;
  country: string;
  role?: string;
  tasksCompleted: number;
  handoversOut: number;
  onTime: number;
  updatedAt?: string;
  profile?: UserProfile;
  email?: string;
  avatar?: string;
  status?: 'active' | 'on-leave' | 'inactive';
}

export interface User {
  name: string;
  role: string;
  office: string;
  country: string;
  email: string;
  team?: string;
  password?: string;
  isSuperAdmin?: boolean;
  avatar?: string;
  phone?: string;
}

export interface WorkspaceUser extends User {
  id: string;
  team: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  approvedAt?: string;
  profile?: UserProfile;
  passwordHash?: string;
  lastLoginAt?: string;
  loginAttempts?: number;
  lockedUntil?: string;
}

export interface PendingSignupRequest {
  id: string;
  name: string;
  email: string;
  password: string;
  team: string;
  office: string;
  country: string;
  requestedAt: string;
  verificationCode?: string;
  verifiedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLocked: boolean;
  lastActivity: number;
  sessionId?: string;
  expiresAt?: number;
  rememberMe?: boolean;
}

export interface AppState {
  theme: 'light' | 'dark';
  user: User;
  tasks: Task[];
  handovers: Handover[];
  offices: Office[];
  members: Member[];
  teams: string[];
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt?: string;
  pendingChanges: number;
  error?: string;
}

export type AIProviderName = 'openai' | 'anthropic' | 'groq' | 'alibaba' | 'local' | 'custom' | 'mock';

export interface AIResult {
  text: string;
  provider: AIProviderName;
  latencyMs?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}
