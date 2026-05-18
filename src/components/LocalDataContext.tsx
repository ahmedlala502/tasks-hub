import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { AuthState, Handover, Member, Office, PendingSignupRequest, Shift, Task, User, WorkspaceUser } from '../types';
import { WorkspaceSettings } from '../lib/localStore';
import { MASTER_ADMIN_EMAIL } from '../constants';
import { AuditEvent, clearAuthState, createId, getAuthState, importWorkspace, loadWorkspace, LocalWorkspace, normalizeTask, resetWorkspace, saveAuthState, saveWorkspace } from '../lib/localStore';
import { cloudStore } from '../lib/cloudStore';
import { migrateLocalStorageToCloud } from '../lib/migration';
import { AppPage, FeatureKey, filterHandoversByTeam, filterMembersByTeam, filterOfficesByTeam, filterTasksByTeam, getCurrentTeam, resolvePermissionProfile, WidgetKey } from '../lib/accessControl';
import { hashPassword, verifyPassword, generateSessionId, calculateSessionExpiration } from '../lib/authService';
import { addToast } from '../lib/toast';
import { REAL_EMPLOYEE_ROSTER } from '../ops/data/employeeRoster';
import { getRosterCredentialEmail } from '../ops/lib/onlineUsers';
import { DEFAULT_ACCESS_PASSWORD } from '../ops/auth/defaultAccessUsers';

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface SignupPayload {
  name: string;
  email: string;
  password: string;
  team: string;
  office: string;
  country: string;
}

interface LocalDataContextType extends LocalWorkspace {
  loading: boolean;
  isReady: boolean;
  auth: AuthState;
  sync: { isOnline: boolean; isSyncing: boolean; lastSyncedAt?: string; pendingChanges: number; error?: string };
  login: (email: string, password: string) => Promise<AuthResult>;
  requestSignup: (payload: SignupPayload) => Promise<AuthResult>;
  approveSignup: (id: string) => Promise<void>;
  rejectSignup: (id: string) => Promise<void>;
  logout: () => void;
  lock: () => void;
  currentTeam: string;
  isMasterAdmin: boolean;
  isSuperAdmin: boolean;
  hasAdminAccess: boolean;
  scopedTasks: Task[];
  scopedHandovers: Handover[];
  scopedMembers: Member[];
  scopedOffices: Office[];
  canAccessPage: (page: AppPage) => boolean;
  canUseFeature: (feature: FeatureKey) => boolean;
  isWidgetEnabled: (widget: WidgetKey) => boolean;
  addTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTasks: (ids: string[]) => Promise<void>;
  addHandover: (handover: Partial<Handover>) => Promise<void>;
  updateHandover: (id: string, patch: Partial<Handover>) => Promise<void>;
  deleteHandover: (id: string) => Promise<void>;
  addOffice: (office: Partial<Office>) => Promise<void>;
  updateOffice: (id: string, patch: Partial<Office>) => Promise<void>;
  deleteOffice: (id: string) => Promise<void>;
  addMember: (member: Partial<Member> & { email?: string; password?: string }) => Promise<void>;
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  updateSettings: (settings: WorkspaceSettings) => Promise<void>;
  updateUser: (patch: Partial<LocalWorkspace['user']>) => Promise<void>;
  exportWorkspace: () => LocalWorkspace;
  importData: (json: string) => boolean;
  resetData: () => Promise<void>;
  logAction: (action: string, details?: unknown, severity?: 'info' | 'warning' | 'error' | 'critical') => Promise<void>;
  restoreSession: () => boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  executeAITool: (toolName: string, args: Record<string, string>) => Promise<string>;
  getWorkspaceSummary: () => { tasksSummary: string; handoverSummary: string; memberStats: string };
}

const LocalDataContext = createContext<LocalDataContextType | undefined>(undefined);

function toSessionUser(account: WorkspaceUser): User {
  return {
    name: account.name,
    role: account.role,
    office: account.office,
    country: account.country,
    email: account.email,
    team: account.team,
    // SECURITY: Never expose password hash in session user context
    password: undefined,
    isSuperAdmin: account.isSuperAdmin,
  };
}

function isMasterAccount(user?: Pick<User, 'email'>) {
  return user?.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
}

export function LocalDataProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<LocalWorkspace>(() => loadWorkspace());
  const [auth, setAuth] = useState<AuthState>(() => getAuthState());
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState({ isOnline: navigator.onLine, isSyncing: false, lastSyncedAt: undefined as string | undefined, pendingChanges: 0, error: undefined as string | undefined });
  const rosterSeededRef = React.useRef(false);

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    const initCloudSync = async () => {
      try {
        setLoading(true);
        await cloudStore.init();
        
        const [users, tasks, handovers, offices, members, settings, auditLogs, pendingSignups] = await Promise.all([
          cloudStore.getUsers(),
          cloudStore.getTasks(),
          cloudStore.getHandovers(),
          cloudStore.getOffices(),
          cloudStore.getMembers(),
          cloudStore.getSettings(),
          cloudStore.getAuditLogs(),
          cloudStore.getSignupRequests(),
        ]);

        const hasCloudData = users.length > 0 || tasks.length > 0;
        
        if (!hasCloudData) {
          const migrated = await migrateLocalStorageToCloud();
          if (migrated) {
            const [migratedUsers, migratedTasks, migratedHandovers, migratedOffices, migratedMembers, migratedSettings, migratedAuditLogs, migratedSignups] = await Promise.all([
              cloudStore.getUsers(),
              cloudStore.getTasks(),
              cloudStore.getHandovers(),
              cloudStore.getOffices(),
              cloudStore.getMembers(),
              cloudStore.getSettings(),
              cloudStore.getAuditLogs(),
              cloudStore.getSignupRequests(),
            ]);

            const seed = loadWorkspace();
            const cloudWorkspace: LocalWorkspace = {
              user: workspace.user,
              users: migratedUsers.length > 0 ? migratedUsers : seed.users,
              pendingSignups: migratedSignups.length > 0 ? migratedSignups : seed.pendingSignups,
              tasks: migratedTasks.length > 0 ? migratedTasks : seed.tasks,
              handovers: migratedHandovers.length > 0 ? migratedHandovers : seed.handovers,
              offices: migratedOffices.length > 0 ? migratedOffices : seed.offices,
              members: migratedMembers.length > 0 ? migratedMembers : seed.members,
              settings: migratedSettings || seed.settings,
              auditLogs: migratedAuditLogs.length > 0 ? migratedAuditLogs : seed.auditLogs,
            };

            setWorkspace(cloudWorkspace);
          }
        } else {
          const seed = loadWorkspace();
          const cloudWorkspace: LocalWorkspace = {
            user: workspace.user,
            users: users.length > 0 ? users : seed.users,
            pendingSignups: pendingSignups.length > 0 ? pendingSignups : seed.pendingSignups,
            tasks: tasks.length > 0 ? tasks : seed.tasks,
            handovers: handovers.length > 0 ? handovers : seed.handovers,
            offices: offices.length > 0 ? offices : seed.offices,
            members: members.length > 0 ? members : seed.members,
            settings: settings || seed.settings,
            auditLogs: auditLogs.length > 0 ? auditLogs : seed.auditLogs,
          };

          setWorkspace(cloudWorkspace);
        }

        setSyncState(prev => ({ ...prev, isOnline: true, lastSyncedAt: new Date().toISOString() }));

        cloudStore.subscribeToTasks((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT') {
              if (current.tasks.some(task => task.id === payload.new.id)) return current;
              return { ...current, tasks: [payload.new as Task, ...current.tasks] };
            } else if (payload.eventType === 'UPDATE') {
              return { ...current, tasks: current.tasks.map(t => t.id === payload.new.id ? payload.new as Task : t) };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, tasks: current.tasks.filter(t => t.id !== payload.old.id) };
            }
            return current;
          });
        });

        cloudStore.subscribeToHandovers((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT') {
              if (current.handovers.some(handover => handover.id === payload.new.id)) return current;
              return { ...current, handovers: [payload.new as Handover, ...current.handovers] };
            } else if (payload.eventType === 'UPDATE') {
              return { ...current, handovers: current.handovers.map(h => h.id === payload.new.id ? payload.new as Handover : h) };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, handovers: current.handovers.filter(h => h.id !== payload.old.id) };
            }
            return current;
          });
        });

        cloudStore.subscribeToUsers((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedUsers = current.users.filter(u => u.email !== payload.new.email);
              return { ...current, users: [payload.new as WorkspaceUser, ...updatedUsers] };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, users: current.users.filter(u => u.email !== payload.old.email) };
            }
            return current;
          });
        });

        cloudStore.subscribeToMembers((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedMembers = current.members.filter(m => m.id !== payload.new.id);
              return { ...current, members: [payload.new as Member, ...updatedMembers] };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, members: current.members.filter(m => m.id !== payload.old.id) };
            }
            return current;
          });
        });

        cloudStore.subscribeToOffices((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedOffices = current.offices.filter(o => o.id !== payload.new.id);
              return { ...current, offices: [payload.new as Office, ...updatedOffices] };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, offices: current.offices.filter(o => o.id !== payload.old.id) };
            }
            return current;
          });
        });

        cloudStore.subscribeToSettings((payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setWorkspace(current => ({ ...current, settings: payload.new.settings }));
          }
        });

        cloudStore.subscribeToAuditLogs((payload) => {
          if (payload.eventType !== 'INSERT') return;
          setWorkspace(current => {
            const incoming = payload.new as AuditEvent;
            if (current.auditLogs.some(e => e.id === incoming.id)) return current;
            return { ...current, auditLogs: [incoming, ...current.auditLogs].slice(0, 200) };
          });
        });

        cloudStore.subscribeToSignupRequests((payload) => {
          setWorkspace(current => {
            if (payload.eventType === 'INSERT') {
              return { ...current, pendingSignups: [payload.new as PendingSignupRequest, ...current.pendingSignups] };
            } else if (payload.eventType === 'UPDATE') {
              return { ...current, pendingSignups: current.pendingSignups.map(s => s.id === payload.new.id ? payload.new as PendingSignupRequest : s) };
            } else if (payload.eventType === 'DELETE') {
              return { ...current, pendingSignups: current.pendingSignups.filter(s => s.id !== payload.old.id) };
            }
            return current;
          });
        });

      } catch (error) {
        console.error('Failed to initialize cloud sync:', error);
        setSyncState(prev => ({ ...prev, isOnline: false, error: 'Cloud sync failed, using local storage' }));
        const localWorkspace = loadWorkspace();
        setWorkspace(localWorkspace);
      } finally {
        setLoading(false);
      }
    };

    initCloudSync();

    return () => {
      cloudStore.unsubscribeAll();
    };
  }, []);

  // Seed roster users into workspace so they have login access and sync to Supabase (runs once per session)
  useEffect(() => {
    if (loading || !syncState.isOnline || rosterSeededRef.current) return;
    rosterSeededRef.current = true;

    const seedRosterUsers = async () => {
      try {
        const defaultPasswordHash = await hashPassword(DEFAULT_ACCESS_PASSWORD);
        const newMembers: Member[] = [];
        const newUsers: WorkspaceUser[] = [];

        for (const employee of REAL_EMPLOYEE_ROSTER) {
          const email = getRosterCredentialEmail(employee.name).toLowerCase();
          if (workspace.users.some(u => u.email.toLowerCase() === email)) continue;

          const createdAt = new Date().toISOString();
          const member = {
            id: createId('member'),
            name: employee.name,
            team: employee.department || 'Operations',
            office: employee.office || 'Egypt',
            country: 'Egypt',
            role: employee.roleTask || 'Operations Agent',
            tasksCompleted: 0,
            handoversOut: 0,
            onTime: 0,
            updatedAt: createdAt,
            status: 'active' as const,
          };

          const user = {
            id: createId('user'),
            name: employee.name,
            role: member.role,
            office: member.office,
            country: member.country,
            email,
            password: defaultPasswordHash,
            team: member.team,
            status: 'active' as const,
            createdAt,
            approvedAt: createdAt,
          };

          newMembers.push(member);
          newUsers.push(user);
        }

        if (newMembers.length > 0) {
          // Persist all new roster members + users to Supabase in parallel
          await Promise.all([
            ...newMembers.map(m => cloudStore.saveMember(m).catch(err => console.warn('saveMember failed:', err))),
            ...newUsers.map(u => cloudStore.saveUser(u).catch(err => console.warn('saveUser failed:', err))),
          ]);
          setWorkspace(current => ({
            ...current,
            members: [...newMembers, ...current.members],
            users: [...newUsers, ...current.users],
          }));
          addToast('Synced ' + newMembers.length + ' roster users to workspace.', 'success', 4000);
        }
      } catch (err) {
        console.error('Failed to seed roster users:', err);
      }
    };

    seedRosterUsers();
  }, [loading, syncState.isOnline]);


  const commit = useCallback((updater: (current: LocalWorkspace) => LocalWorkspace) => {
    setWorkspace(current => updater(current));
  }, []);

  const appendAudit = (current: LocalWorkspace, action: string, details?: unknown, severity: 'info' | 'warning' | 'error' | 'critical' = 'info'): LocalWorkspace => {
    const event: AuditEvent = {
      id: createId('audit'),
      action,
      details: details || {},
      timestamp: new Date().toISOString(),
      userId: current.user.email,
      severity,
    };
    // Persist to Supabase so the Activity Feed page survives reloads and is shared across users
    cloudStore.logAudit(event).catch(err => console.warn('Audit log persist failed:', err));
    return { ...current, auditLogs: [event, ...current.auditLogs].slice(0, 200) };
  };

  const isMasterAdmin = useMemo(() => isMasterAccount(workspace.user), [workspace.user]);
  const isSuperAdmin = useMemo(
    () => isMasterAdmin || workspace.user.isSuperAdmin === true || workspace.user.role === 'Super Admin',
    [isMasterAdmin, workspace.user.isSuperAdmin, workspace.user.role],
  );
  const hasAdminAccess = useMemo(
    () => isSuperAdmin || ['super admin', 'admin', 'manager', 'lead', 'head', 'director', 'general'].some(r => workspace.user.role.toLowerCase().includes(r)),
    [isSuperAdmin, workspace.user.role],
  );
  const currentTeam = useMemo(() => getCurrentTeam(workspace.user, workspace.members), [workspace.user, workspace.members]);
  const permissionProfile = useMemo(
    () => resolvePermissionProfile(workspace.user.role, workspace.settings.rolePermissions),
    [workspace.user.role, workspace.settings.rolePermissions],
  );
  const allowedTeams = useMemo(() => (isSuperAdmin ? ['*'] : permissionProfile.teams), [isSuperAdmin, permissionProfile.teams]);
  const teamIsolation = workspace.settings.featureFlags?.teamIsolation !== false;
  const scopedTasks = useMemo(
    () => filterTasksByTeam(workspace.tasks, allowedTeams, teamIsolation),
    [workspace.tasks, allowedTeams, teamIsolation],
  );
  const scopedHandovers = useMemo(
    () => filterHandoversByTeam(workspace.handovers, allowedTeams, teamIsolation),
    [workspace.handovers, allowedTeams, teamIsolation],
  );
  const scopedMembers = useMemo(
    () => filterMembersByTeam(workspace.members, allowedTeams, teamIsolation),
    [workspace.members, allowedTeams, teamIsolation],
  );
  const scopedOffices = useMemo(
    () => filterOfficesByTeam(workspace.offices, workspace.tasks, workspace.members, allowedTeams, teamIsolation),
    [workspace.offices, workspace.tasks, workspace.members, allowedTeams, teamIsolation],
  );

  React.useEffect(() => {
    const needsUserFix = (workspace.user.isSuperAdmin || workspace.user.role === 'Super Admin') && workspace.user.role !== 'Super Admin';
    const needsAccountFix = workspace.users.some(user => user.isSuperAdmin && user.role !== 'Super Admin');

    if (!needsUserFix && !needsAccountFix) return;

    setWorkspace(current => {
      const nextUsers = current.users.map(user => user.isSuperAdmin
        ? { ...user, role: 'Super Admin', status: 'active' as const }
        : user);

      const next = {
        ...current,
        user: current.user.isSuperAdmin
          ? { ...current.user, role: 'Super Admin', isSuperAdmin: true }
          : current.user,
        users: nextUsers,
      };
      return next;
    });
  }, []);

  React.useEffect(() => {
    const handler = () => {
      if (navigator.onLine) {
        addToast('Connection restored', 'success', 3000);
      } else {
        addToast('You are offline. Changes will be saved locally.', 'warning', 5000);
      }
    };
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const sanitizeUserPatch = async (patch: Partial<LocalWorkspace['user']>, currentUser: LocalWorkspace['user']) => {
    if (isMasterAdmin) {
      const nextPatch = { ...patch };
      delete (nextPatch as Record<string, unknown>).isSuperAdmin;
      if (typeof nextPatch.password === 'string' && nextPatch.password.trim() && !nextPatch.password.startsWith('$PBKDF2$')) {
        nextPatch.password = await hashPassword(nextPatch.password.trim());
      }
      return {
        ...nextPatch,
        role: 'Super Admin',
        isSuperAdmin: true,
      };
    }

    const nextPatch = { ...patch };
    delete (nextPatch as Record<string, unknown>).role;
    delete (nextPatch as Record<string, unknown>).isSuperAdmin;

    if (nextPatch.email?.toLowerCase() === MASTER_ADMIN_EMAIL) {
      nextPatch.email = currentUser.email;
    }

    if (typeof nextPatch.password === 'string' && nextPatch.password.trim() && !nextPatch.password.startsWith('$PBKDF2$')) {
      nextPatch.password = await hashPassword(nextPatch.password.trim());
    }

    return nextPatch;
  };

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    
    // Input validation
    if (!normalizedEmail || !normalizedPassword) {
      return { ok: false, error: 'Email and password are required.' };
    }
    
    const account = workspace.users.find(user => user.email.toLowerCase() === normalizedEmail);
    const pendingRequest = workspace.pendingSignups.find(request => request.email.toLowerCase() === normalizedEmail);

    // FIX: Do NOT auto-approve pending signups on login. Security bug removed.
    if (!account && pendingRequest) {
      return { ok: false, error: 'Your access request is still pending admin approval.' };
    }

    if (!account) {
      // Log failed login attempt for non-existent account
      commit(current => appendAudit(current, 'LOGIN_FAILED', { email: normalizedEmail, reason: 'account_not_found' }, 'warning'));
      return { ok: false, error: 'No approved account was found for this email.' };
    }

    const passwordValid = await verifyPassword(normalizedPassword, account.password || '');
    if (!passwordValid) {
      commit(current => appendAudit(current, 'LOGIN_FAILED', { email: normalizedEmail, reason: 'invalid_password' }, 'warning'));
      return { ok: false, error: 'Incorrect email or password.' };
    }

    // Successful login
    const sessionId = generateSessionId();
    const expiresAt = calculateSessionExpiration(24);

    const updatedUsers = workspace.users.map(u =>
      u.email.toLowerCase() === normalizedEmail
        ? { ...u, loginAttempts: 0, lockedUntil: undefined, status: 'active' as const, lastLoginAt: new Date().toISOString() }
        : u
    );
    await cloudStore.updateUser(normalizedEmail, { lastLoginAt: new Date().toISOString(), loginAttempts: 0, lockedUntil: undefined, status: 'active' });
    commit(current => appendAudit({
      ...current,
      user: toSessionUser(account),
      users: updatedUsers,
    }, 'LOGIN_SUCCESS', { email: normalizedEmail, sessionId }, 'info'));

    const state: AuthState = { isAuthenticated: true, isLocked: false, lastActivity: Date.now(), sessionId, expiresAt };
    setAuth(state);
    saveAuthState(state);
    return { ok: true };
  }, [workspace.users, workspace.pendingSignups]);

  const requestSignup = useCallback(async (payload: SignupPayload): Promise<AuthResult> => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const trimmedPassword = payload.password.trim();

    if (!payload.name.trim() || !normalizedEmail || !trimmedPassword) {
      return { ok: false, error: 'Please complete the full access request form.' };
    }

    if (normalizedEmail === MASTER_ADMIN_EMAIL) {
      return { ok: false, error: 'This email address is reserved. Please use a different email.' };
    }

    if (workspace.users.some(user => user.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: 'An approved account already exists for this email. Please sign in instead.' };
    }

    if (workspace.pendingSignups.some(request => request.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: 'An access request for this email is already pending admin approval.' };
    }

    const hashedPassword = await hashPassword(trimmedPassword);
    const newSignup = {
      id: createId('signup'),
      name: payload.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      team: payload.team,
      office: payload.office,
      country: payload.country,
      requestedAt: new Date().toISOString(),
    };
    await cloudStore.saveSignupRequest(newSignup);
    commit(current => appendAudit({
      ...current,
      pendingSignups: [newSignup, ...current.pendingSignups],
    }, 'SIGNUP_REQUEST', { email: normalizedEmail, team: payload.team }));

    addToast('Access request submitted successfully!', 'success', 6000);
    return { ok: true };
  }, [workspace.pendingSignups, workspace.users]);

  const logout = useCallback(() => {
    setAuth({ isAuthenticated: false, isLocked: false, lastActivity: 0 });
    clearAuthState();
    addToast('You have been signed out.', 'info', 3000);
  }, []);

  const lock = useCallback(() => {
    const state: AuthState = { ...auth, isLocked: true };
    setAuth(state);
    saveAuthState(state);
    addToast('Session locked for security.', 'warning', 3000);
  }, [auth]);

  const restoreSession = useCallback((): boolean => {
    const state = getAuthState();
    if (state.isAuthenticated && !state.isLocked && state.expiresAt && state.expiresAt > Date.now()) {
      setAuth(state);
      return true;
    }
    return false;
  }, []);

  const canUsePrivilegedFeature = (feature: FeatureKey) => {
    if (['users.manage', 'widgets.manage', 'ai.configure'].includes(feature)) {
      return isMasterAdmin;
    }
    // Super Admins can access settings and all standard features
    if (feature === 'settings.manage') {
      return isSuperAdmin;
    }
    return isSuperAdmin || permissionProfile.features.includes(feature);
  };

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    const account = workspace.users.find(user => user.email.toLowerCase() === workspace.user.email.toLowerCase());
    if (!account) return { ok: false, error: 'User not found' };

    if (!(await verifyPassword(currentPassword, account.password || ''))) {
      return { ok: false, error: 'Current password is incorrect.' };
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await cloudStore.updateUser(account.email, { password: hashedNewPassword });
    commit(current => appendAudit({
      ...current,
      user: { ...current.user, password: hashedNewPassword },
      users: current.users.map(u => u.email.toLowerCase() === account.email.toLowerCase()
        ? { ...u, password: hashedNewPassword }
        : u),
    }, 'PASSWORD_CHANGED', { email: account.email }));

    addToast('Password updated successfully.', 'success', 4000);
    return { ok: true };
  }, [workspace.users, workspace.user.email]);

    const value = useMemo<LocalDataContextType>(() => {
      const sync = {
        isOnline: syncState.isOnline,
        isSyncing: syncState.isSyncing,
        pendingChanges: syncState.pendingChanges,
        lastSyncedAt: syncState.lastSyncedAt,
        error: syncState.error,
      };

    return {
      ...workspace,
      auth,
      loading,
      isReady: !loading,
      sync,
      login,
      requestSignup,
      approveSignup: async (id) => {
        if (!isMasterAdmin && !isSuperAdmin) return;
        
        const request = workspace.pendingSignups.find(item => item.id === id);
        if (!request) return;

        const approvedAt = new Date().toISOString();
        const nextUser: WorkspaceUser = {
          id: createId('user'),
          name: request.name,
          role: 'Viewer',
          office: request.office,
          country: request.country,
          email: request.email,
          password: request.password,
          team: request.team,
          status: 'active' as const,
          createdAt: request.requestedAt,
          approvedAt,
        };

        const existingMember = workspace.members.find(member => member.name === request.name);
        const nextMember = existingMember
          ? { ...existingMember, role: existingMember.role || 'Viewer', team: request.team, office: request.office, country: request.country, updatedAt: approvedAt }
          : {
              id: createId('member'),
              name: request.name,
              team: request.team,
              office: request.office,
              country: request.country,
              role: 'Viewer',
              tasksCompleted: 0,
              handoversOut: 0,
              onTime: 0,
              updatedAt: approvedAt,
              status: 'active' as const,
            };

        await cloudStore.saveUser(nextUser);
        await cloudStore.saveMember(nextMember);
        await cloudStore.deleteSignupRequest(id);

        commit(current => {
          const nextMembers = current.members.find(m => m.id === nextMember.id)
            ? current.members.map(m => m.id === nextMember.id ? nextMember : m)
            : [nextMember, ...current.members];
          
          return appendAudit({
            ...current,
            users: [nextUser, ...current.users.filter(user => user.email.toLowerCase() !== request.email.toLowerCase())],
            pendingSignups: current.pendingSignups.filter(item => item.id !== id),
            members: nextMembers,
          }, 'SIGNUP_APPROVED', { email: request.email, role: 'Viewer' });
        });

        addToast(`${request.name}'s account has been approved.`, 'success', 4000);
      },
      rejectSignup: async (id) => {
        if (!isMasterAdmin && !isSuperAdmin) return;
        await cloudStore.deleteSignupRequest(id);
        commit(current => {
          const request = current.pendingSignups.find(item => item.id === id);
          if (!request) return current;
          addToast(`${request.name}'s access request has been rejected.`, 'info', 4000);
          return appendAudit({
            ...current,
            pendingSignups: current.pendingSignups.filter(item => item.id !== id),
          }, 'SIGNUP_REJECTED', { email: request.email });
        });
      },
      logout,
      lock,
      restoreSession,
      changePassword,
      currentTeam,
      isMasterAdmin,
      isSuperAdmin,
      hasAdminAccess,
      scopedTasks,
      scopedHandovers,
      scopedMembers,
      scopedOffices,
      canAccessPage: page => {
        if (page === 'activity') return isMasterAdmin;
        if (page === 'settings') return isSuperAdmin;
        return isSuperAdmin || permissionProfile.pages.includes(page);
      },
      canUseFeature: feature => canUsePrivilegedFeature(feature),
      isWidgetEnabled: widget => workspace.settings.widgetConfig?.[widget] !== false,
      addTask: async task => {
        const newTask = normalizeTask({ ...task, creatorId: task.creatorId || workspace.user.email }, workspace.user);
        await cloudStore.saveTask(newTask);
        commit(current => appendAudit({
          ...current,
          tasks: [newTask, ...current.tasks],
        }, 'TASK_CREATE', { title: task.title }));
        addToast('Task created successfully.', 'success', 3000);
      },
      updateTask: async (id, patch) => {
        await cloudStore.updateTask(id, patch);
        commit(current => appendAudit({
          ...current,
          tasks: current.tasks.map(task => task.id === id ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task),
        }, 'TASK_UPDATE', { id, patch }));
      },
      deleteTasks: async ids => {
        await cloudStore.deleteTasks(ids);
        commit(current => appendAudit({
          ...current,
          tasks: current.tasks.filter(task => !ids.includes(task.id)),
        }, 'TASK_DELETE', { count: ids.length }));
        addToast(`${ids.length} task(s) deleted.`, 'info', 3000);
      },
      addHandover: async handover => {
        const newHandover = {
          id: createId('handover'),
          date: handover.date || new Date().toISOString().split('T')[0],
          fromShift: handover.fromShift!,
          toShift: handover.toShift!,
          fromOffice: handover.fromOffice || '',
          toOffice: handover.toOffice || '',
          team: handover.team || workspace.settings.teams[0],
          country: handover.country || workspace.user.country,
          outgoing: handover.outgoing || workspace.user.name,
          incoming: handover.incoming || 'TBD',
          status: handover.status || 'Pending',
          watchouts: handover.watchouts || '',
          taskIds: handover.taskIds || [],
          createdAt: handover.createdAt || new Date().toISOString(),
          ackAt: handover.ackAt,
          creatorId: handover.creatorId || workspace.user.email || 'local-workspace',
        };
        await cloudStore.saveHandover(newHandover);
        commit(current => appendAudit({
          ...current,
          handovers: [newHandover, ...current.handovers],
        }, 'HANDOVER_INITIATE', { taskCount: handover.taskIds?.length || 0 }));
        addToast('Handover created successfully.', 'success', 3000);
      },
      updateHandover: async (id, patch) => {
        await cloudStore.updateHandover(id, patch);
        commit(current => appendAudit({
          ...current,
          handovers: current.handovers.map(handover => handover.id === id ? { ...handover, ...patch } : handover),
        }, 'HANDOVER_UPDATE', { id, patch }));
      },
      deleteHandover: async id => {
        await cloudStore.deleteHandover(id);
        commit(current => appendAudit({
          ...current,
          handovers: current.handovers.filter(handover => handover.id !== id),
        }, 'HANDOVER_DELETE', { id }));
      },
      addOffice: async office => {
        const newOffice = { id: createId('office'), name: office.name || 'New Hub', country: office.country || 'EG', lead: office.lead || workspace.user.name, shift: office.shift || Shift.MORNING, timezone: office.timezone, address: office.address, phone: office.phone };
        await cloudStore.saveOffice(newOffice);
        commit(current => appendAudit({
          ...current,
          offices: [newOffice, ...current.offices],
        }, 'OFFICE_REGISTER', { name: office.name }));
        addToast(`Office "${office.name}" registered.`, 'success', 3000);
      },
      updateOffice: async (id, patch) => {
        await cloudStore.updateOffice(id, patch);
        commit(current => appendAudit({
          ...current,
          offices: current.offices.map(office => office.id === id ? { ...office, ...patch } : office),
        }, 'OFFICE_UPDATE', { id, patch }));
      },
      deleteOffice: async id => {
        await cloudStore.deleteOffice(id);
        commit(current => appendAudit({
          ...current,
          offices: current.offices.filter(office => office.id !== id),
        }, 'OFFICE_DELETE', { id }));
      },
      addMember: async member => {
        if (!hasAdminAccess) {
          addToast('Insufficient permissions to add members.', 'error', 4000);
          return;
        }
        const hashedMemberPassword = member.password ? await hashPassword(member.password) : '';
        
        const createdAt = new Date().toISOString();
        const name = member.name?.trim() || 'New Member';
        const role = member.role || 'Operations Agent';
        const team = member.team || workspace.settings.teams[0];
        const office = member.office || workspace.user.office;
        const country = member.country || workspace.user.country;
        const emailBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
        const email = (member.email || `${emailBase || 'user'}@trygc.local`).trim().toLowerCase();

        if (workspace.users.some(u => u.email.toLowerCase() === email)) {
          addToast('A user with this email already exists.', 'error', 4000);
          return;
        }

        const newMember: Member = {
          id: createId('member'),
          name,
          team,
          office,
          country,
          role,
          tasksCompleted: member.tasksCompleted || 0,
          handoversOut: member.handoversOut || 0,
          onTime: member.onTime || 0,
          updatedAt: createdAt,
          status: 'active' as const,
        };

        const newUser: WorkspaceUser = {
          id: createId('user'),
          name,
          role,
          office,
          country,
          email,
          password: hashedMemberPassword,
          team,
          status: 'active' as const,
          createdAt,
          approvedAt: createdAt,
        };

        await cloudStore.saveMember(newMember);
        await cloudStore.saveUser(newUser);
        
        commit(current => appendAudit({
          ...current,
          members: [newMember, ...current.members],
          users: [newUser, ...current.users],
        }, 'MEMBER_CREATE', { name, email }));
        
        addToast('Member added successfully.', 'success', 3000);
      },
      updateMember: async (id, patch) => {
        if (!hasAdminAccess) {
          addToast('Insufficient permissions to update members.', 'error', 4000);
          return;
        }
        await cloudStore.updateMember(id, patch);
        commit(current => {
          const target = current.members.find(member => member.id === id);
          if (!target) return current;
          const updatedName = patch.name || target.name;
          const updatedRole = patch.role || target.role || 'Viewer';
          const updatedOffice = patch.office || target.office;
          const updatedCountry = patch.country || target.country;
          const updatedTeam = patch.team || target.team;

          return appendAudit({
            ...current,
            members: current.members.map(member => member.id === id ? { ...member, ...patch, updatedAt: new Date().toISOString() } : member),
            users: current.users.map(account => account.name === target.name
              ? { ...account, name: updatedName, role: updatedRole, office: updatedOffice, country: updatedCountry, team: updatedTeam }
              : account),
            user: current.user.name === target.name
              ? { ...current.user, name: updatedName, role: isMasterAccount(current.user) ? 'Super Admin' : updatedRole, office: updatedOffice, country: updatedCountry, team: updatedTeam }
              : current.user,
          }, 'MEMBER_UPDATE', { id, patch });
        });
      },
      deleteMember: async id => {
        if (!hasAdminAccess) {
          addToast('Insufficient permissions to remove members.', 'error', 4000);
          return;
        }
        await cloudStore.deleteMember(id);
        commit(current => {
          const target = current.members.find(member => member.id === id);
          if (!target) return current;
          return appendAudit({
            ...current,
            members: current.members.filter(member => member.id !== id),
            users: current.users.filter(account => account.name !== target.name || isMasterAccount(account)),
          }, 'MEMBER_DELETE', { id });
        });
        addToast('Member removed successfully.', 'info', 3000);
      },
      updateSettings: async settings => {
        if (!isMasterAdmin) {
          addToast('Only the master admin can change workspace settings.', 'error', 4000);
          return;
        }
        await cloudStore.saveSettings(settings);
        commit(current => appendAudit({ ...current, settings }, 'SETTINGS_UPDATE', {}));
      },
      updateUser: async patch => {
        const safePatch = await sanitizeUserPatch(patch, workspace.user);
        await cloudStore.updateUser(workspace.user.email, safePatch);
        commit(current => {
          const nextUser = { ...current.user, ...safePatch };
          const previousName = current.user.name;
          const previousEmail = current.user.email.toLowerCase();

          return appendAudit({
            ...current,
            user: nextUser,
            users: current.users.map(account => account.email.toLowerCase() === previousEmail
              ? { ...account, name: nextUser.name, role: isMasterAccount(nextUser) ? 'Super Admin' : nextUser.role, office: nextUser.office, country: nextUser.country, email: nextUser.email, password: nextUser.password, team: nextUser.team || account.team }
              : account),
            members: current.members.map(member => member.name === previousName
              ? { ...member, name: nextUser.name, role: isMasterAccount(nextUser) ? 'Super Admin' : nextUser.role, office: nextUser.office, country: nextUser.country, updatedAt: new Date().toISOString() }
              : member),
          }, 'PROFILE_UPDATE', safePatch);
        });
      },
      exportWorkspace: () => workspace,
      importData: (json: string) => {
        const imported = importWorkspace(json);
        if (!imported) {
          addToast('Failed to import workspace data. Invalid format.', 'error', 4000);
          return false;
        }
        setWorkspace(imported);
        cloudStore.migrateFromLocal(imported);
        addToast('Workspace data imported successfully.', 'success', 4000);
        return true;
      },
      resetData: async () => {
        clearAuthState();
        const defaultWorkspace = resetWorkspace();
        await cloudStore.migrateFromLocal(defaultWorkspace);
        setWorkspace(defaultWorkspace);
        setAuth({ isAuthenticated: false, isLocked: false, lastActivity: 0 });
        addToast('Workspace has been reset to default state.', 'warning', 6000);
      },
      logAction: async (action, details, severity) => {
        const event: AuditEvent = {
          id: createId('audit'),
          action,
          details: details || {},
          timestamp: new Date().toISOString(),
          userId: workspace.user.email,
          severity,
        };
        await cloudStore.logAudit(event);
        commit(current => appendAudit(current, action, details, severity));
      },
      executeAITool: async (toolName, args) => {
        const notAllowed = 'Permission denied: your role does not have access to this action.';
        const now = new Date().toISOString();

        switch (toolName) {
          case 'createTask': {
            if (!canUsePrivilegedFeature('task.create')) return notAllowed;
            const aiTask = normalizeTask({ ...args, title: args.title || 'AI Task', creatorId: workspace.user.email || 'ai-agent' }, workspace.user);
            await cloudStore.saveTask(aiTask);
            commit(current => appendAudit({
              ...current,
              tasks: [aiTask, ...current.tasks],
            }, 'TASK_CREATE', { title: args.title, viaAI: true }));
            return `Task "${args.title}" created.`;
          }
          case 'updateTask':
            if (!canUsePrivilegedFeature('task.edit')) return notAllowed;
            if (!args.id) return 'Missing task ID.';
            await cloudStore.updateTask(args.id, { ...args, updatedAt: now }).catch(err => console.warn('AI updateTask cloud sync failed:', err));
            commit(current => appendAudit({
              ...current,
              tasks: current.tasks.map(t => t.id === args.id ? { ...t, ...args, updatedAt: now } : t),
            }, 'TASK_UPDATE', { id: args.id }));
            return `Task ${args.id} updated.`;
          case 'deleteTask':
            if (!canUsePrivilegedFeature('task.delete')) return notAllowed;
            if (!args.id) return 'Missing task ID.';
            await cloudStore.deleteTasks([args.id]).catch(err => console.warn('AI deleteTask cloud sync failed:', err));
            commit(current => appendAudit({
              ...current, tasks: current.tasks.filter(t => t.id !== args.id),
            }, 'TASK_DELETE', { id: args.id }));
            return `Task ${args.id} deleted.`;
          case 'listTasks': {
            let filtered = workspace.tasks;
            if (args.status) filtered = filtered.filter(t => t.status === args.status);
            if (args.priority) filtered = filtered.filter(t => t.priority === args.priority);
            if (args.team) filtered = filtered.filter(t => t.team === args.team);
            if (args.owner) filtered = filtered.filter(t => t.owner === args.owner);
            const limit = args.limit ? parseInt(args.limit) : 20;
            return JSON.stringify(filtered.slice(0, limit).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, owner: t.owner, team: t.team })));
          }
          case 'getTask': {
            const task = workspace.tasks.find(t => t.id === args.id);
            return task ? JSON.stringify(task) : 'Task not found.';
          }
          case 'createHandover': {
            if (!canUsePrivilegedFeature('handover.create')) return notAllowed;
            const aiHandover = {
              id: createId('handover'), date: now.split('T')[0],
              fromShift: (args.fromShift || 'Morning') as any,
              toShift: (args.toShift || 'Mid') as any,
              fromOffice: args.fromOffice || workspace.user.office,
              toOffice: args.toOffice || workspace.user.office,
              outgoing: args.outgoing || workspace.user.name,
              incoming: args.incoming || 'TBD', status: 'Pending' as const,
              watchouts: args.watchouts || '', taskIds: args.taskIds ? args.taskIds.split(',').map(s => s.trim()).filter(Boolean) : [],
              createdAt: now, creatorId: workspace.user.email || 'ai-agent',
            };
            await cloudStore.saveHandover(aiHandover as any);
            commit(current => appendAudit({
              ...current,
              handovers: [aiHandover as any, ...current.handovers],
            }, 'HANDOVER_INITIATE', { fromShift: args.fromShift, toShift: args.toShift, viaAI: true }));
            return `Handover created (${args.fromShift} → ${args.toShift}).`;
          }
          case 'updateHandover': {
            if (!canUsePrivilegedFeature('handover.edit')) return notAllowed;
            if (!args.id) return 'Missing handover ID.';
            const hoPatch = { ...(args.status ? { status: args.status as any } : {}), ...(args.incoming ? { incoming: args.incoming } : {}), ...(args.watchouts !== undefined ? { watchouts: args.watchouts } : {}) };
            await cloudStore.updateHandover(args.id, hoPatch).catch(err => console.warn('AI updateHandover cloud sync failed:', err));
            commit(current => appendAudit({
              ...current, handovers: current.handovers.map(h => h.id === args.id ? { ...h, ...hoPatch } : h),
            }, 'HANDOVER_UPDATE', { id: args.id }));
            return `Handover ${args.id} updated.`;
          }
          case 'acknowledgeHandover': {
            if (!canUsePrivilegedFeature('handover.ack')) return notAllowed;
            if (!args.id) return 'Missing handover ID.';
            const ackPatch = { status: 'Acknowledged' as const, ackAt: now };
            await cloudStore.updateHandover(args.id, ackPatch).catch(err => console.warn('AI acknowledgeHandover cloud sync failed:', err));
            commit(current => appendAudit({
              ...current, handovers: current.handovers.map(h => h.id === args.id ? { ...h, ...ackPatch } : h),
            }, 'HANDOVER_ACK', { id: args.id }));
            return `Handover ${args.id} acknowledged.`;
          }
          case 'deleteHandover':
            if (!canUsePrivilegedFeature('handover.delete')) return notAllowed;
            if (!args.id) return 'Missing handover ID.';
            await cloudStore.deleteHandover(args.id).catch(err => console.warn('AI deleteHandover cloud sync failed:', err));
            commit(current => appendAudit({
              ...current, handovers: current.handovers.filter(h => h.id !== args.id),
            }, 'HANDOVER_DELETE', { id: args.id }));
            return `Handover ${args.id} deleted.`;
          case 'listHandovers': {
            let filtered = workspace.handovers;
            if (args.status) filtered = filtered.filter(h => h.status === args.status);
            if (args.team) filtered = filtered.filter(h => h.team === args.team);
            const limit = args.limit ? parseInt(args.limit) : 20;
            return JSON.stringify(filtered.slice(0, limit).map(h => ({ id: h.id, date: h.date, fromShift: h.fromShift, toShift: h.toShift, outgoing: h.outgoing, incoming: h.incoming, status: h.status })));
          }
          case 'createMember':
            if (!canUsePrivilegedFeature('members.manage')) return notAllowed;
            commit(current => appendAudit({
              ...current,
              members: [{
                id: createId('member'), name: args.name || 'New Member', role: args.role || 'Operations Agent',
                team: args.team || currentTeam, office: args.office || workspace.user.office,
                country: args.country || workspace.user.country, tasksCompleted: 0, handoversOut: 0, onTime: 0,
                updatedAt: now, status: 'active' as const,
              }, ...current.members],
            }, 'MEMBER_CREATE', { name: args.name }));
            return `Member "${args.name}" added.`;
          case 'updateMember':
            if (!canUsePrivilegedFeature('members.manage')) return notAllowed;
            if (!args.id) return 'Missing member ID.';
            commit(current => appendAudit({
              ...current, members: current.members.map(m => m.id === args.id ? { ...m, role: args.role || m.role, team: args.team || m.team, office: args.office || m.office, updatedAt: now } : m),
            }, 'MEMBER_UPDATE', { id: args.id }));
            return `Member ${args.id} updated.`;
          case 'deleteMember':
            if (!canUsePrivilegedFeature('members.manage')) return notAllowed;
            if (!args.id) return 'Missing member ID.';
            await cloudStore.deleteMember(args.id).catch(err => console.warn('AI deleteMember cloud sync failed:', err));
            commit(current => appendAudit({
              ...current, members: current.members.filter(m => m.id !== args.id),
            }, 'MEMBER_DELETE', { id: args.id }));
            return `Member ${args.id} deleted.`;
          case 'createOffice':
            if (!canUsePrivilegedFeature('offices.manage')) return notAllowed;
            commit(current => appendAudit({
              ...current,
              offices: [{ id: createId('office'), name: args.name || 'New Office', country: args.country || 'EG', lead: args.lead || workspace.user.name, shift: (args.shift || 'Morning') as any, timezone: args.timezone || undefined }, ...current.offices],
            }, 'OFFICE_REGISTER', { name: args.name }));
            return `Office "${args.name}" created.`;
          case 'updateOffice':
            if (!canUsePrivilegedFeature('offices.manage')) return notAllowed;
            if (!args.id) return 'Missing office ID.';
            commit(current => appendAudit({
              ...current, offices: current.offices.map(o => o.id === args.id ? { ...o, name: args.name || o.name, lead: args.lead || o.lead, shift: (args.shift as any) || o.shift } : o),
            }, 'OFFICE_UPDATE', { id: args.id }));
            return `Office ${args.id} updated.`;
          case 'deleteOffice':
            if (!canUsePrivilegedFeature('offices.manage')) return notAllowed;
            if (!args.id) return 'Missing office ID.';
            commit(current => appendAudit({
              ...current, offices: current.offices.filter(o => o.id !== args.id),
            }, 'OFFICE_DELETE', { id: args.id }));
            return `Office ${args.id} deleted.`;
          case 'getWorkspaceStats':
            return JSON.stringify({
              totalTasks: workspace.tasks.length, openTasks: workspace.tasks.filter(t => t.status !== 'Done').length,
              riskTasks: workspace.tasks.filter(t => t.status === 'Blocked').length,
              totalHandovers: workspace.handovers.length, pendingHandovers: workspace.handovers.filter(h => h.status === 'Pending').length,
              totalMembers: workspace.members.length, totalOffices: workspace.offices.length,
              teams: [...new Set(workspace.members.map(m => m.team))],
            });
          case 'getMemberByName': {
            const member = workspace.members.find(m => m.name.toLowerCase() === (args.name || '').toLowerCase());
            return member ? JSON.stringify(member) : `Member "${args.name}" not found.`;
          }
          default:
            return `Unknown tool: ${toolName}`;
        }
      },
      getWorkspaceSummary: () => {
        const openCount = workspace.tasks.filter(t => t.status !== 'Done').length;
        const riskCount = workspace.tasks.filter(t => t.status !== 'Done' && (t.priority === 'High' || t.status === 'Blocked')).length;
        const carryCount = workspace.tasks.filter(t => t.carry && t.status !== 'Done').length;
        const pendingHandovers = workspace.handovers.filter(h => h.status === 'Pending').length;
        const ackHandovers = workspace.handovers.filter(h => h.status === 'Acknowledged').length;
        return {
          tasksSummary: `${openCount} open tasks, ${riskCount} risk tasks, ${carryCount} carry-over tasks for ${currentTeam}.`,
          handoverSummary: `${pendingHandovers} pending handovers, ${ackHandovers} acknowledged.`,
          memberStats: `${workspace.members.length} members across ${workspace.offices.length} offices.`,
        };
      },
    };
  }, [workspace, auth, login, requestSignup, logout, lock, restoreSession, changePassword, currentTeam, isMasterAdmin, isSuperAdmin, hasAdminAccess, scopedTasks, scopedHandovers, scopedMembers, scopedOffices, permissionProfile, commit, syncState, loading]);

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData() {
  const context = useContext(LocalDataContext);
  if (!context) throw new Error('useLocalData must be used within LocalDataProvider');
  return context;
}
