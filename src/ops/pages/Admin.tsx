/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Download,
  Key,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
} from 'lucide-react';
import { dataService, exportAllData, importAllData, downloadJson } from '../services/dataService';
import { useAuth } from '../App';
import { OPS_OFFICES, type OpsOffice, type OpsRole } from '../auth/types';
import { adminApi } from '../services/adminApi';
import { BulkUploadButton } from '../components/BulkUploadDialog';
import { rowsToUsers, type UserImportRow } from '../services/spreadsheetService';
import { DEFAULT_ACCESS_PASSWORD, DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';

type AdminRole = 'Master' | 'Operations' | 'Community';
type AccessLevel = 'Full' | 'Scoped' | 'Read Only';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  office: OpsOffice;
  access: AccessLevel;
  status: 'Active' | 'Suspended';
  lastSeen: string;
  source: 'cloud' | 'roster';
};

type ModulePolicy = {
  id: string;
  label: string;
  description: string;
  owner: AdminRole;
  enabled: boolean;
  approvalRequired: boolean;
};

type FeatureFlag = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

type DataCounts = {
  campaigns: number;
  influencers: number;
  blockers: number;
  tasks: number;
};

const STORAGE_KEY = 'trygc-admin-access-center';

const seedRoleToAdminRole = (role: OpsRole): AdminRole => {
  if (role === 'master') return 'Master';
  if (role === 'community') return 'Community';
  return 'Operations';
};

const defaultUsers: AdminUser[] = DEFAULT_ACCESS_USERS.map((user) => ({
  id: `seed-${user.email}`,
  name: user.name,
  email: user.email,
  role: seedRoleToAdminRole(user.role),
  office: user.office,
  access: user.role === 'master' ? 'Full' : 'Scoped',
  status: 'Active',
  lastSeen: 'Never',
  source: 'roster',
}));

const defaultPolicies: ModulePolicy[] = [
  { id: 'tasks', label: 'Task Management', description: 'Assign, reassign, edit, and close operational tasks.', owner: 'Operations', enabled: true, approvalRequired: false },
  { id: 'handover', label: 'Shift Handover', description: 'Move ownership between shifts and track relay accountability.', owner: 'Operations', enabled: true, approvalRequired: false },
  { id: 'community', label: 'Community Workspace', description: 'Manage community-side outreach, contacts, and handoff ownership inside the shared workspace.', owner: 'Community', enabled: true, approvalRequired: false },
  { id: 'settings', label: 'Settings & Theme', description: 'Customize dashboards, widgets, providers, and workspace identity.', owner: 'Master', enabled: true, approvalRequired: true },
  { id: 'audit', label: 'Audit Logs', description: 'Review admin changes, data exports, and sensitive operations.', owner: 'Master', enabled: true, approvalRequired: true },
  { id: 'reports', label: 'Reporting Center', description: 'Publish operational reports and download stakeholder summaries.', owner: 'Operations', enabled: true, approvalRequired: false },
];

const defaultFlags: FeatureFlag[] = [
  { id: 'maintenance', label: 'Maintenance Mode', description: 'Temporarily pause public workflows while admins continue working.', enabled: false },
  { id: 'strict-rbac', label: 'Strict RBAC', description: 'Require module-level permissions before saving sensitive changes.', enabled: true },
  { id: 'bulk-upload', label: 'Bulk Uploads', description: 'Allow CSV and Excel imports for campaigns and influencers.', enabled: true },
  { id: 'ai-discovery', label: 'Provider AI Discovery', description: 'Enable configured AI providers from Settings for discovery runs.', enabled: true },
  { id: 'daily-digest', label: 'Daily Digest', description: 'Send the operations digest to stakeholders at 9:00 AM.', enabled: true },
];

const getDataCounts = (): DataCounts => ({
  campaigns: dataService.getCampaigns().length,
  influencers: dataService.getInfluencers().length,
  blockers: dataService.getBlockers().length,
  tasks: dataService.getTasks().length,
});

const normalizeAdminRole = (value: string | undefined): AdminRole => {
  if (value === 'Master' || value === 'Owner' || value === 'Super Admin') return 'Master';
  if (value === 'Community') return 'Community';
  return 'Operations';
};

const roleToOpsRole = (role: AdminRole): OpsRole => {
  if (role === 'Master') return 'master';
  if (role === 'Community') return 'community';
  return 'operations';
};

const opsRoleToAdminRole = (role: OpsRole): AdminRole => {
  if (role === 'master') return 'Master';
  if (role === 'community') return 'Community';
  return 'Operations';
};

const formatLastSeen = (value?: string | null) => {
  if (!value) return 'Never';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const mapApiUserToAdminUser = (user: {
  uid: string;
  email: string;
  displayName: string;
  role: OpsRole;
  office: OpsOffice;
  status: 'active' | 'suspended';
  lastSignInAt?: string | null;
}): AdminUser => ({
  id: user.uid,
  name: user.displayName,
  email: user.email,
  role: opsRoleToAdminRole(user.role),
  office: user.office,
  access: user.role === 'master' ? 'Full' : 'Scoped',
  status: user.status === 'suspended' ? 'Suspended' : 'Active',
  lastSeen: formatLastSeen(user.lastSignInAt),
  source: 'cloud',
});

const mergeCloudAndRosterUsers = (cloudUsers: AdminUser[]) => {
  const cloudEmails = new Set(cloudUsers.map(user => user.email.toLowerCase()));
  const missingRosterUsers = defaultUsers.filter(user => !cloudEmails.has(user.email.toLowerCase()));
  return [...cloudUsers, ...missingRosterUsers];
};

const isCloudBackedUser = (user: AdminUser) => user.source === 'cloud';

export default function Admin() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>(defaultUsers);
  const [policies, setPolicies] = useState<ModulePolicy[]>(defaultPolicies);
  const [flags, setFlags] = useState<FeatureFlag[]>(defaultFlags);
  const [dataCounts, setDataCounts] = useState<DataCounts>(getDataCounts);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Operations' as AdminRole, office: 'Egypt' as OpsOffice, access: 'Scoped' as AccessLevel });
  const [userCreateError, setUserCreateError] = useState('');
  const [search, setSearch] = useState('');
  const [savedAt, setSavedAt] = useState('Ready');
  const [hydrated, setHydrated] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [generatingAccess, setGeneratingAccess] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const refreshUsers = useCallback(async (showStatus = false) => {
    setUsersLoading(true);
    try {
      const apiUsers = await adminApi.listUsers();
      const cloudUsers = apiUsers.map(mapApiUserToAdminUser);
      const mergedUsers = mergeCloudAndRosterUsers(cloudUsers);
      setUsers(mergedUsers);
      if (showStatus) setSavedAt(`Users refreshed: ${cloudUsers.length} cloud accounts + ${mergedUsers.length - cloudUsers.length} roster users`);
    } catch (error: any) {
      setUsers((current) => (current.length > 0 ? current : defaultUsers));
      setSavedAt(error.message || 'Admin API unavailable');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.policies)) {
        setPolicies(parsed.policies.map((policy: ModulePolicy) => ({ ...policy, owner: normalizeAdminRole(policy.owner) })));
      }
      if (Array.isArray(parsed.flags)) setFlags(parsed.flags);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ policies, flags }));
  }, [flags, hydrated, policies]);

  useEffect(() => {
    void refreshUsers();
    const interval = window.setInterval(() => { void refreshUsers(); }, 30000);
    return () => window.clearInterval(interval);
  }, [refreshUsers]);

  const visibleUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return users;
    return users.filter(user =>
      [user.name, user.email, user.role, user.access, user.status].some(item => item.toLowerCase().includes(value)),
    );
  }, [search, users]);

  const fullAccessCount = users.filter(user => user.access === 'Full' && user.status === 'Active').length;
  const activeModules = policies.filter(policy => policy.enabled).length;
  const enabledFlags = flags.filter(flag => flag.enabled).length;

  const updateUser = async (id: string, patch: Partial<AdminUser>) => {
    const targetUser = users.find(user => user.id === id);
    if (!targetUser) return;

    const nextName = patch.name ?? targetUser.name;
    const nextRole = patch.role ?? targetUser.role;
    const nextStatus = patch.status ?? targetUser.status;
    const nextOffice = patch.office ?? targetUser.office;

    if (!isCloudBackedUser(targetUser)) {
      try {
        const created = await adminApi.createUser({
          name: nextName,
          email: targetUser.email,
          password: DEFAULT_ACCESS_PASSWORD,
          role: roleToOpsRole(nextRole),
          office: nextOffice,
          department: nextRole === 'Community' ? 'Coordination' : 'Operations',
          title: nextRole === 'Master' ? 'Master Admin' : `${nextRole} Access`,
        });
        setUsers(prev => prev.map(user => (user.id === id ? mapApiUserToAdminUser(created) : user)));
        setSavedAt(`${nextName} activated in Supabase`);
        dataService.recordActivity({
          action: 'admin.user_created',
          entityType: 'user',
          entityId: created.uid,
          summary: `Activated user ${nextName}`,
          metadata: { email: targetUser.email, role: nextRole },
        });
      } catch (error: any) {
        setSavedAt(error.message || 'Unable to activate user');
      }
      return;
    }

    try {
      const updated = await adminApi.updateUser({
        id,
        name: nextName,
        role: roleToOpsRole(nextRole),
        office: nextOffice,
        status: nextStatus === 'Suspended' ? 'suspended' : 'active',
      });

      setUsers(prev => prev.map(user => (user.id === id ? mapApiUserToAdminUser(updated) : user)));
      setSavedAt('Supabase user updated');
      dataService.recordActivity({
        action: 'admin.user_updated',
        entityType: 'user',
        entityId: id,
        summary: `Updated user ${nextName}`,
        metadata: { role: nextRole, status: nextStatus, office: nextOffice },
      });
    } catch (error: any) {
      setSavedAt(error.message || 'Unable to update user');
    }
  };

  const updatePolicy = (id: string, patch: Partial<ModulePolicy>) => {
    setPolicies(prev => prev.map(policy => (policy.id === id ? { ...policy, ...patch } : policy)));
    setSavedAt('Saved locally');
    dataService.recordActivity({
      action: 'admin.policy_updated',
      entityType: 'policy',
      entityId: id,
      summary: `Updated module policy ${id}`,
      metadata: { patch },
    });
  };

  const updateFlag = (id: string) => {
    setFlags(prev => prev.map(flag => (flag.id === id ? { ...flag, enabled: !flag.enabled } : flag)));
    setSavedAt('Saved locally');
    dataService.recordActivity({
      action: 'admin.feature_toggled',
      entityType: 'feature',
      entityId: id,
      summary: `Toggled feature ${id}`,
      metadata: {},
    });
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserCreateError('');

    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const password = newUser.password;

    if (!name || !email || !password) {
      setUserCreateError('Name, email, and password are required.');
      return;
    }

    if (password.length < 6) {
      setUserCreateError('Password must be at least 6 characters.');
      return;
    }

    try {
      const createdUser = await adminApi.createUser({
        name,
        email,
        password,
        role: roleToOpsRole(newUser.role),
        office: newUser.office,
        department: newUser.role === 'Community' ? 'Coordination' : 'Operations',
        title: newUser.role === 'Master' ? 'Master Admin' : `${newUser.role} Access`,
      });

      setUsers(prev => [mapApiUserToAdminUser(createdUser), ...prev.filter(user => user.email.toLowerCase() !== email)]);

      setNewUser({ name: '', email: '', password: '', role: 'Operations', office: 'Egypt', access: 'Scoped' });
      setSavedAt('Supabase user created');
      dataService.recordActivity({
        action: 'admin.user_created',
        entityType: 'user',
        entityId: createdUser.uid,
        summary: `Created user ${name}`,
        metadata: { email, role: newUser.role, office: newUser.office },
      });
    } catch (error: any) {
      setUserCreateError(error.message || 'Unable to create Supabase user.');
    }
  };

  const removeUser = (targetUser: AdminUser) => {
    const normalizedEmail = targetUser.email.toLowerCase();
    if (currentUser?.email?.toLowerCase() === normalizedEmail) {
      setSavedAt('Cannot remove current user');
      return;
    }
    if (!isCloudBackedUser(targetUser)) {
      setSavedAt('Roster user is not a Supabase account yet');
      return;
    }

    const confirmed = window.confirm(`Remove ${targetUser.name} (${targetUser.email})? This removes the Supabase account and access profile.`);
    if (!confirmed) return;

    adminApi.deleteUser(targetUser.id)
      .then(() => {
        setUsers(prev => prev.filter(user => user.id !== targetUser.id));
        setSavedAt('Supabase user removed');
        dataService.recordActivity({
          action: 'admin.user_deleted',
          entityType: 'user',
          entityId: targetUser.id,
          summary: `Removed user ${targetUser.name}`,
          metadata: { email: targetUser.email, role: targetUser.role },
        });
      })
      .catch((error: any) => {
        setSavedAt(error.message || 'Unable to remove user');
      });
  };

  const generateDefaultAccess = async () => {
    setGeneratingAccess(true);
    setUserCreateError('');

    try {
      let latestUsers = await adminApi.listUsers();
      let created = 0;
      let updated = 0;

      for (const seed of DEFAULT_ACCESS_USERS) {
        const existing = latestUsers.find(user => user.email.toLowerCase() === seed.email.toLowerCase());

        if (existing) {
          const nextUser = await adminApi.updateUser({
            id: existing.uid,
            name: seed.name,
            password: DEFAULT_ACCESS_PASSWORD,
            role: seed.role,
            office: seed.office,
            status: 'active',
            department: seed.department,
            title: seed.title,
          });
          latestUsers = latestUsers.map(user => user.uid === nextUser.uid ? nextUser : user);
          updated += 1;
          continue;
        }

        const createdUser = await adminApi.createUser({
          name: seed.name,
          email: seed.email,
          password: DEFAULT_ACCESS_PASSWORD,
          role: seed.role,
          office: seed.office,
          department: seed.department,
          title: seed.title,
        });
        latestUsers = [createdUser, ...latestUsers];
        created += 1;
      }

      const cloudUsers = latestUsers.map(mapApiUserToAdminUser);
      setUsers(mergeCloudAndRosterUsers(cloudUsers));
      setSavedAt(`Default access ready: ${created} created, ${updated} updated · password ${DEFAULT_ACCESS_PASSWORD}`);
      dataService.recordActivity({
        action: 'admin.default_access_generated',
        entityType: 'user',
        summary: `Generated default access: ${created} created, ${updated} updated`,
        metadata: { created, updated },
      });
    } catch (error: any) {
      setSavedAt(error.message || 'Unable to generate default access');
      setUserCreateError(error.message || 'Unable to generate default access.');
    } finally {
      setGeneratingAccess(false);
    }
  };

  const refreshDataCounts = () => setDataCounts(getDataCounts());

  const grantFullAccess = () => {
    setUsers(prev => prev.map(user => ({ ...user, access: 'Full', status: 'Active' })));
    setPolicies(prev => prev.map(policy => ({ ...policy, enabled: true })));
    setFlags(prev => prev.map(flag => (flag.id === 'maintenance' ? { ...flag, enabled: false } : { ...flag, enabled: true })));
    setSavedAt('Full access enabled');
    dataService.recordActivity({
      action: 'admin.full_access_granted',
      entityType: 'policy',
      summary: 'Granted full workspace access',
      metadata: { users: users.length, policies: policies.length, flags: flags.length },
    });
  };

  const resetDefaults = () => {
    setPolicies(defaultPolicies);
    setFlags(defaultFlags);
    setSavedAt('Defaults restored');
    dataService.recordActivity({
      action: 'admin.defaults_restored',
      entityType: 'settings',
      summary: 'Restored admin defaults',
      metadata: {},
    });
  };

  const handleExport = () => {
    const data = exportAllData();
    downloadJson(data, `trygc-export-${new Date().toISOString().slice(0, 10)}.json`);
    setSavedAt('Export downloaded');
    dataService.recordActivity({
      action: 'workspace.exported',
      entityType: 'workspace',
      summary: 'Exported workspace data from Admin',
      metadata: getDataCounts(),
    });
  };

  const handleBackup = () => {
    const data = exportAllData();
    downloadJson(data, `trygc-backup-${Date.now()}.json`);
    setSavedAt('Backup file created');
    dataService.recordActivity({
      action: 'workspace.backup_created',
      entityType: 'workspace',
      summary: 'Created workspace backup',
      metadata: getDataCounts(),
    });
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importAllData(data);
        refreshDataCounts();
        setSavedAt('Import successful — reload to refresh views');
      } catch {
        setSavedAt('Import failed: invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm(`Restore from "${file.name}"? All current workspace data will be replaced.`);
    if (!confirmed) {
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importAllData(data);
        refreshDataCounts();
        setSavedAt('Restore complete — reload to refresh views');
      } catch {
        setSavedAt('Restore failed: invalid backup file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gc-orange" />
        <div className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-gc-orange/10" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gc-orange/10 border border-gc-orange/20 rounded-lg text-[9.5px] font-extrabold uppercase tracking-widest text-gc-orange mb-3">
              <Lock size={11} /> Root Access Enabled
            </div>
            <h2 className="font-condensed font-extrabold text-[26px] tracking-tight text-foreground">Admin Control Center</h2>
            <p className="text-[12px] font-semibold text-muted-foreground mt-1 max-w-2xl">
              Full workspace control for permissions, modules, provider access, bulk operations, data tools, and audit visibility.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 min-w-full xl:min-w-[450px]">
            <Metric label="Full Access" value={fullAccessCount.toString()} tone="orange" />
            <Metric label="Modules Live" value={`${activeModules}/${policies.length}`} tone="green" />
            <Metric label="Features On" value={`${enabledFlags}/${flags.length}`} tone="purple" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
        <div className="space-y-6">
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Access Directory</p>
                <h3 className="font-condensed font-extrabold text-[18px] text-foreground">Admins, Roles & Session Control</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="h-10 min-w-[260px] bg-secondary border border-border rounded-lg px-3 flex items-center gap-2 focus-within:border-gc-orange">
                  <Search size={14} className="text-muted-foreground" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search admins"
                    className="w-full bg-transparent outline-none text-[12px] font-semibold text-foreground placeholder:text-muted-foreground"
                  />
                </label>
                <button onClick={grantFullAccess} className="h-10 px-4 rounded-lg bg-gc-orange text-white text-[11px] font-extrabold uppercase tracking-widest hover:bg-gc-orange-hover transition-colors flex items-center justify-center gap-2">
                  <ShieldCheck size={14} /> Grant All
                </button>
                <button
                  onClick={generateDefaultAccess}
                  disabled={generatingAccess}
                  className="h-10 px-4 rounded-lg border border-gc-orange/30 bg-gc-orange/10 text-gc-orange text-[11px] font-extrabold uppercase tracking-widest hover:bg-gc-orange/15 transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  title={`Create missing roster users with password ${DEFAULT_ACCESS_PASSWORD}`}
                >
                  <Key size={14} /> {generatingAccess ? 'Generating...' : 'Generate Access'}
                </button>
                <button
                  onClick={() => { void refreshUsers(true); }}
                  className="h-10 px-4 rounded-lg border border-border bg-card text-[11px] font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Refresh Users
                </button>
                <BulkUploadButton<UserImportRow>
                  label="Bulk Upload"
                  title="Bulk Import Users"
                  templateHeaders={['email','name','password','role','office','department','title']}
                  parse={rowsToUsers}
                  validate={u => {
                    const errs: string[] = [];
                    if (!u.email || !/.+@.+\..+/.test(u.email)) errs.push('Invalid email');
                    if (!u.name) errs.push('Missing name');
                    if (!u.password || u.password.length < 8) errs.push('Password must be 8+ chars');
                    return errs;
                  }}
                  commit={async items => {
                    let inserted = 0;
                    const errors: string[] = [];
                    for (const u of items) {
                      try {
                        await adminApi.createUser({
                          email: u.email,
                          name: u.name,
                          password: u.password,
                          role: u.role,
                          office: u.office ?? 'Egypt',
                          department: u.department as any,
                          title: u.title,
                        });
                        inserted++;
                      } catch (err) {
                        errors.push(`${u.email}: ${err instanceof Error ? err.message : 'failed'}`);
                      }
                    }
                    try {
                      const latest = await adminApi.listUsers();
                      setUsers(mergeCloudAndRosterUsers(latest.map(mapApiUserToAdminUser)));
                    } catch {
                      /* refresh failed; UI will re-sync on next page load */
                    }
                    if (errors.length > 0) {
                      console.warn('Bulk user import errors', errors);
                    }
                    return { inserted, updated: 0 };
                  }}
                />
              </div>
            </div>

            <form onSubmit={createUser} className="border-b border-border bg-muted/20 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Supabase Auth</p>
                  <h4 className="font-condensed font-extrabold text-[16px] text-foreground">Create User With Password</h4>
                </div>
                <Users size={17} className="text-muted-foreground" />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_0.85fr_0.75fr_0.75fr_0.75fr_auto]">
                <input
                  value={newUser.name}
                  onChange={event => setNewUser(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="Full name"
                  className="h-10 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground outline-none focus:border-gc-orange"
                />
                <input
                  type="email"
                  value={newUser.email}
                  onChange={event => setNewUser(prev => ({ ...prev, email: event.target.value }))}
                  placeholder="Email"
                  className="h-10 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground outline-none focus:border-gc-orange"
                />
                <input
                  type="password"
                  value={newUser.password}
                  onChange={event => setNewUser(prev => ({ ...prev, password: event.target.value }))}
                  placeholder="Password"
                  className="h-10 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground outline-none focus:border-gc-orange"
                />
                <Select
                  value={newUser.role}
                  onChange={value => setNewUser(prev => ({
                    ...prev,
                    role: value as AdminRole,
                    office: value === 'Community' && prev.office === 'Egypt' ? 'KSA' : prev.office,
                  }))}
                  options={['Master', 'Operations', 'Community']}
                />
                <Select
                  value={newUser.office}
                  onChange={value => setNewUser(prev => ({ ...prev, office: value as OpsOffice }))}
                  options={[...OPS_OFFICES]}
                />
                <Select
                  value={newUser.access}
                  onChange={value => setNewUser(prev => ({ ...prev, access: value as AccessLevel }))}
                  options={['Full', 'Scoped', 'Read Only']}
                />
                <button className="h-10 rounded-lg bg-gc-orange px-4 text-[10px] font-extrabold uppercase tracking-widest text-white hover:bg-gc-orange-hover transition-colors">
                  Create
                </button>
              </div>

              {userCreateError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  {userCreateError}
                </div>
              )}
            </form>

            <div className="divide-y divide-border">
                  {usersLoading ? (
                    <div className="p-5 text-[12px] font-semibold text-muted-foreground">Loading Supabase users...</div>
                  ) : visibleUsers.map(user => {
                    const cloudBacked = isCloudBackedUser(user);
                    return (
                <div key={user.id} className="p-5 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.75fr_auto_auto] gap-4 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-gc-orange/10 text-gc-orange flex items-center justify-center font-condensed font-black text-[14px]">
                      {user.name.split(' ').map(part => part[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[13px] font-extrabold text-foreground truncate">{user.name}</p>
                        {!cloudBacked && (
                          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-widest text-amber-700">
                            Roster
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={user.role}
                      onChange={value => { void updateUser(user.id, { role: value as AdminRole }); }}
                      options={['Master', 'Operations', 'Community']}
                      disabled={!cloudBacked}
                    />
                    <Select
                      value={user.office}
                      onChange={value => { void updateUser(user.id, { office: value as OpsOffice }); }}
                      options={[...OPS_OFFICES]}
                      disabled={!cloudBacked}
                    />
                    <Select
                      value={user.access}
                      onChange={() => {}}
                      options={['Full', 'Scoped', 'Read Only']}
                      disabled={!cloudBacked}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { void updateUser(user.id, { status: user.status === 'Active' ? 'Suspended' : 'Active' }); }}
                      disabled={!cloudBacked}
                      className={`h-9 px-3 rounded-lg border text-[10px] font-extrabold uppercase tracking-widest transition-colors ${
                        user.status === 'Active'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-600'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {user.status}
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{user.lastSeen}</span>
                  </div>

                  <button
                    onClick={() => { void updateUser(user.id, { role: user.role, status: 'Active' }); }}
                    disabled={!cloudBacked}
                    className="h-9 px-3 rounded-lg bg-secondary border border-border text-[10px] font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Full Access
                  </button>

                  <button
                    onClick={() => removeUser(user)}
                    disabled={!cloudBacked || currentUser?.email?.toLowerCase() === user.email.toLowerCase()}
                    className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-[10px] font-extrabold uppercase tracking-widest text-red-700 hover:bg-red-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              );
                  })}
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Permission Matrix</p>
                <h3 className="font-condensed font-extrabold text-[18px] text-foreground">Editable Module Access</h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{savedAt}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {policies.map(policy => (
                <div key={policy.id} className="border border-border rounded-xl p-4 bg-background hover:border-gc-orange/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-condensed font-extrabold text-[15px] text-foreground">{policy.label}</h4>
                      <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed mt-1">{policy.description}</p>
                    </div>
                    <button
                      onClick={() => updatePolicy(policy.id, { enabled: !policy.enabled })}
                      className={`shrink-0 ${policy.enabled ? 'text-gc-orange' : 'text-muted-foreground'}`}
                      aria-label={`Toggle ${policy.label}`}
                    >
                      {policy.enabled ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Select
                      value={policy.owner}
                      onChange={value => updatePolicy(policy.id, { owner: value as AdminRole })}
                      options={['Master', 'Operations', 'Community']}
                    />
                    <button
                      onClick={() => updatePolicy(policy.id, { approvalRequired: !policy.approvalRequired })}
                      className={`h-9 px-3 rounded-lg border text-[10px] font-extrabold uppercase tracking-widest ${
                        policy.approvalRequired
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-secondary border-border text-muted-foreground'
                      }`}
                    >
                      {policy.approvalRequired ? 'Approval' : 'Direct'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Feature Gates</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Workspace Switchboard</h3>
              </div>
              <SlidersHorizontal size={18} className="text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {flags.map(flag => (
                <button
                  key={flag.id}
                  onClick={() => updateFlag(flag.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-gc-orange/50 transition-colors"
                >
                  <span>
                    <span className="block text-[12px] font-extrabold text-foreground">{flag.label}</span>
                    <span className="block text-[10.5px] font-semibold text-muted-foreground mt-0.5">{flag.description}</span>
                  </span>
                  {flag.enabled ? <ToggleRight size={32} className="text-gc-orange" /> : <ToggleLeft size={32} className="text-muted-foreground" />}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Data Tools</p>
              <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Backups, Imports & Exports</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={<Download size={14} />} label="Export Data" onClick={handleExport} />
              <ActionButton icon={<Upload size={14} />} label="Import Data" onClick={() => importRef.current?.click()} />
              <ActionButton icon={<Archive size={14} />} label="Create Backup" onClick={handleBackup} />
              <ActionButton icon={<RotateCcw size={14} />} label="Restore Point" onClick={() => restoreRef.current?.click()} />
            </div>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3">
              <CheckCircle2 size={16} className="text-emerald-600 mt-0.5" />
              <div>
                <p className="text-[11px] font-extrabold text-emerald-800">Auto-save enabled</p>
                <p className="text-[10.5px] font-semibold text-emerald-700/80 mt-0.5">Admin changes are stored in this workspace profile.</p>
              </div>
            </div>
          </section>

          <section className="bg-card border border-emerald-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Data Guard</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Workspace Records Protected</h3>
                <p className="mt-1 text-[10.5px] font-semibold text-muted-foreground">Bulk removal controls are locked while the live team is operating.</p>
              </div>
              <Database size={18} className="shrink-0 text-emerald-600" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DataGuardMetric label="Campaigns" value={dataCounts.campaigns} />
              <DataGuardMetric label="Influencers" value={dataCounts.influencers} />
              <DataGuardMetric label="Blockers" value={dataCounts.blockers} />
              <DataGuardMetric label="Tasks" value={dataCounts.tasks} />
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10.5px] font-bold text-emerald-800">
              Export and backup are still available; destructive bulk actions are intentionally hidden.
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Integrations</p>
              <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Provider & API Access</h3>
            </div>
            {[
              { icon: <Key size={15} />, label: 'AI Provider Keys', value: 'Managed in Settings', status: 'Ready' },
              { icon: <Cloud size={15} />, label: 'Bulk Upload Pipeline', value: 'Excel + CSV enabled', status: 'Live' },
              { icon: <Database size={15} />, label: 'Local Workspace Store', value: 'Persistent profile', status: 'Synced' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                <div className="h-9 w-9 rounded-lg bg-gc-orange/10 text-gc-orange flex items-center justify-center">{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold text-foreground">{item.label}</p>
                  <p className="text-[10.5px] font-semibold text-muted-foreground">{item.value}</p>
                </div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-emerald-600">{item.status}</span>
              </div>
            ))}
          </section>

          <section className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Audit Trail</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Recent Admin Events</h3>
              </div>
              <Activity size={17} className="text-muted-foreground" />
            </div>
            {[
              'Root access confirmed for Admin User',
              'AI discovery provider controls enabled',
              'Bulk upload permissions opened',
              'Task management module granted',
            ].map((event, index) => (
              <div key={event} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-gc-orange font-condensed font-black text-[12px]">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold text-foreground truncate">{event}</p>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground">{index === 0 ? 'Now' : `${index * 12}m ago`}</p>
                </div>
                <ChevronRight size={13} className="text-muted-foreground" />
              </div>
            ))}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={resetDefaults} className="h-10 rounded-lg border border-border bg-card text-[10px] font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange transition-colors flex items-center justify-center gap-2">
              <RotateCcw size={13} /> Reset
            </button>
            <button onClick={() => setSavedAt('Saved just now')} className="h-10 rounded-lg bg-gc-orange text-white text-[10px] font-extrabold uppercase tracking-widest hover:bg-gc-orange-hover transition-colors flex items-center justify-center gap-2">
              <Save size={13} /> Save
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'orange' | 'green' | 'purple' }) {
  const tones = {
    orange: 'text-gc-orange bg-gc-orange/10 border-gc-orange/20',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    purple: 'text-purple-600 bg-purple-50 border-purple-200',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[9.5px] font-extrabold uppercase tracking-widest opacity-70">{label}</p>
      <p className="font-condensed font-black text-[24px] leading-none mt-2">{value}</p>
    </div>
  );
}

function Select({ value, options, onChange, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground outline-none focus:border-gc-orange disabled:cursor-not-allowed disabled:opacity-60"
    >
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 rounded-lg border border-border bg-secondary text-[10px] font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange transition-colors flex items-center justify-center gap-2"
    >
      {icon}
      {label}
    </button>
  );
}

function DataGuardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-condensed text-[20px] font-black text-foreground">{value}</p>
    </div>
  );
}
