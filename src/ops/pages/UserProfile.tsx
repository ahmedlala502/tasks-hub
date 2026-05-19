import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  KeyRound,
  Layers3,
  ListChecks,
  Save,
  ShieldCheck,
  MapPin,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../App';
import { OPS_OFFICES, type OpsDepartment, type OpsOffice, type OpsRole, type OpsUser } from '../auth/types';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { ATTACHED_EXPORT_USERS, dataService } from '../services/dataService';
import { notify } from '../services/notificationService';
import { filterBlockersByRole, filterCampaignsByRole, filterHandoversByRole, filterInfluencersByRole, filterTasksByRole } from '../lib/workspace';
import { getTaskManagerPath } from '../lib/taskRoutes';
import {
  buildPerformanceInsights,
  type PerformanceRow,
  type PerformanceUser,
} from '../lib/performanceInsights';
import { isHandoverForUser, isTaskAssignedToUser, isTaskCreatedByUser } from '../lib/personalWork';
import { getOperationalTaskStatus } from '../lib/opsPageInsights';
import { buildOfficeInsights } from '../lib/officeInsights';
import {
  buildPersonalPerformanceLinks,
  buildUserProfileHeader,
  getPrimaryProfileMetrics,
  getSecondaryProfileMetrics,
  type LinkedProfileMetric,
  type ProfileMetric,
} from '../lib/userProfileView';
import { cn } from '../utils';

const DEPARTMENTS: OpsDepartment[] = [
  'Operations',
  'Onboarding',
  'WhatsApp / Live Chat',
  'Coverage & Monitoring',
  'Coordination',
  'Quality & Training',
  'Systems & Automation',
  'Activation',
  'Account Managers',
  'Data Analysis',
];

const TOOL_LINKS = [
  { label: 'Tasks Manager', to: getTaskManagerPath(), icon: ListChecks },
  { label: 'Handovers', to: '/handover', icon: Layers3 },
  { label: 'Blockers', to: '/blockers', icon: CircleAlert },
  { label: 'Reporting', to: '/reporting', icon: BarChart3 },
];

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

function uniqueUsers(users: PerformanceUser[]): PerformanceUser[] {
  const byName = new Map<string, PerformanceUser>();
  users.forEach((user) => {
    const key = normalize(user.name);
    if (!key || byName.has(key)) return;
    byName.set(key, user);
  });
  return [...byName.values()];
}

function mapOpsUser(user: OpsUser): PerformanceUser {
  return {
    name: user.displayName,
    role: user.role,
    office: user.office,
    department: user.department,
    title: user.title,
  };
}

export default function UserProfile() {
  const { user, role, updateProfile, updatePassword } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [office, setOffice] = useState<OpsOffice>(user?.office || 'Egypt');
  const [department, setDepartment] = useState<OpsDepartment>(user?.department || 'Operations');
  const [title, setTitle] = useState(user?.title || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Cairo');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [cloudUsers, setCloudUsers] = useState<OpsUser[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | 'operations' | 'community'>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  useEffect(() => {
    const targetUser = searchParams.get('user');
    if (targetUser) setAgentFilter(targetUser);
  }, [searchParams]);

  useEffect(() => {
    if (role !== 'master') return;
    let alive = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers().then((users) => {
        if (alive) setCloudUsers(users);
      }).catch(() => {});
    });
    return () => { alive = false; };
  }, [role]);

  useEffect(() => {
    return dataService.subscribeToWorkspaceChanges(() => {
      setWorkspaceVersion((version) => version + 1);
    }, ['tasks', 'handovers', 'blockers', 'campaigns', 'influencers']);
  }, []);

  const roster = useMemo(() => uniqueUsers([
    ...DEFAULT_ACCESS_USERS.map((item) => ({
      name: item.name,
      role: item.role,
      office: item.office,
      department: item.department,
      title: item.title,
    })),
    ...ATTACHED_EXPORT_USERS.map(mapOpsUser),
    ...cloudUsers.map(mapOpsUser),
    ...(user ? [mapOpsUser(user)] : []),
  ]), [cloudUsers, user]);

  const workspaceData = useMemo(() => {
    const allTasks = dataService.getTasks();
    const allBlockers = dataService.getBlockers();
    const allCampaigns = dataService.getCampaigns();
    const allInfluencers = dataService.getInfluencers();
    const allHandovers = dataService.getHandovers();

    return {
      tasks: role === 'master' ? allTasks : filterTasksByRole(role, allTasks),
      blockers: role === 'master' ? allBlockers : filterBlockersByRole(role, allBlockers),
      campaigns: role === 'master' ? allCampaigns : filterCampaignsByRole(role, allCampaigns),
      influencers: role === 'master' ? allInfluencers : filterInfluencersByRole(role, allInfluencers),
      handovers: role === 'master' ? allHandovers : filterHandoversByRole(role, allHandovers),
    };
  }, [role, workspaceVersion]);

  const insights = useMemo(() => buildPerformanceInsights({
    users: roster,
    tasks: workspaceData.tasks,
    blockers: workspaceData.blockers,
    campaigns: workspaceData.campaigns,
    influencers: workspaceData.influencers,
    handovers: workspaceData.handovers,
    viewerName: user?.displayName || '',
    viewerRole: role || 'operations',
  }), [roster, workspaceData, user?.displayName, role]);

  const officeUsers = useMemo(() => uniqueOpsUsers([
    ...DEFAULT_ACCESS_USERS.map((item) => ({
      uid: `seed-${item.email}`,
      email: item.email,
      displayName: item.name,
      role: item.role,
      status: 'active' as const,
      office: item.office,
      department: item.department,
      title: item.title,
      timezone: 'Africa/Cairo',
    })),
    ...ATTACHED_EXPORT_USERS,
    ...cloudUsers,
    ...(user ? [user] : []),
  ]), [cloudUsers, user]);

  const officeInsights = useMemo(() => buildOfficeInsights({
    users: officeUsers,
    tasks: workspaceData.tasks,
    handovers: workspaceData.handovers,
    blockers: workspaceData.blockers,
    campaigns: workspaceData.campaigns,
  }), [officeUsers, workspaceData]);

  if (!user) return null;

  const isPerformancePage = location.pathname === '/performance';
  const isProfilePage = location.pathname === '/profile';

  const personal = insights.currentUser?.summary || {
    tasks: 0,
    done: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0,
    completionRate: 0,
    campaigns: 0,
    creators: 0,
    handovers: 0,
  };

  const filteredTeamRows = insights.teamRows.filter((row) => {
    if (workspaceFilter !== 'all') {
      const teamScope = normalize(row.team).includes('coordination') || normalize(row.team).includes('community') ? 'community' : 'operations';
      if (teamScope !== workspaceFilter) return false;
    }
    return teamFilter === 'all' || row.team === teamFilter;
  });

  const filteredAgentRows = insights.agentRows.filter((row) => {
    if (workspaceFilter !== 'all' && row.role !== workspaceFilter && row.role !== 'master') return false;
    if (teamFilter !== 'all' && row.team !== teamFilter) return false;
    if (agentFilter !== 'all' && row.name !== agentFilter) return false;
    return true;
  });

  const targetUserName = searchParams.get('user');
  const targetAgentRow = targetUserName ? insights.agentRows.find(r => r.name === targetUserName) : null;
  const targetRosterUser = targetUserName ? roster.find(r => r.name === targetUserName) : null;
  const viewedName = targetUserName || user.displayName;
  const viewedSummary = targetAgentRow?.summary || personal;
  const viewedRole = targetRosterUser?.role || targetAgentRow?.role || user.role;
  const viewedOffice = targetRosterUser?.office || targetAgentRow?.team || user.office;
  const profileHeader = buildUserProfileHeader({
    viewedName,
    isPerformancePage,
    isTargetUser: Boolean(targetUserName),
    role: viewedRole,
    office: viewedOffice,
    email: user.email,
  });
  const primaryMetrics = getPrimaryProfileMetrics(viewedSummary);
  const secondaryMetrics = getSecondaryProfileMetrics(viewedSummary);
  const assignedToTasks = workspaceData.tasks.filter((task) => isTaskAssignedToUser(task, viewedName));
  const assignedByTasks = workspaceData.tasks.filter((task) => isTaskCreatedByUser(task, viewedName));
  const personalHandovers = workspaceData.handovers.filter((handover) => isHandoverForUser(handover, viewedName));
  const personalPerformanceLinks = buildPersonalPerformanceLinks(viewedName, {
    assignedTo: assignedToTasks.length,
    assignedBy: assignedByTasks.length,
    completed: assignedToTasks.filter((task) => getOperationalTaskStatus(task) === 'Done').length,
    blocked: assignedToTasks.filter((task) => getOperationalTaskStatus(task) === 'Blocked').length,
    handovers: personalHandovers.length,
    total: new Set([...assignedToTasks, ...assignedByTasks].map((task) => task.id)).size,
  });
  const completionTone = viewedSummary.completionRate >= 75 ? 'text-emerald-600' : viewedSummary.blocked > 0 ? 'text-red-600' : 'text-gc-orange';

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await updateProfile({
        displayName: displayName.trim(),
        office,
        department,
        title: title.trim() || 'Team Member',
        timezone: timezone.trim() || 'Africa/Cairo',
      });
      setMessage('Profile saved to cloud account');
      notify('Profile Updated', `${displayName.trim()} profile details saved`, 'green', '/profile');
    } catch (error: any) {
      setMessage(error.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    setPasswordSaving(true);
    setMessage('');
    try {
      await updatePassword(password);
      setPassword('');
      setMessage('Password updated in Supabase Auth');
      notify('Password Updated', `${user.email} password changed`, 'green', '/profile');
    } catch (error: any) {
      setMessage(error.message || 'Unable to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 pb-12">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gc-orange/10 text-gc-orange">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">{profileHeader.eyebrow}</p>
              <h2 className="truncate text-2xl font-extrabold text-foreground">{profileHeader.title}</h2>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{profileHeader.detail}</p>
            </div>
          </div>
          <div className="grid min-w-[min(100%,360px)] grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Metric label="Role" value={viewedRole} />
            <Metric label="Office" value={viewedOffice} />
            <div className="col-span-2 rounded-lg border border-border bg-background px-4 py-3 sm:col-span-1">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Done Rate</p>
              <p className={cn('mt-1 text-xl font-black tabular-nums', completionTone)}>{viewedSummary.completionRate}%</p>
            </div>
          </div>
        </div>
      </section>

      {isPerformancePage && (
        <section className="rounded-lg border border-gc-orange/20 bg-gc-orange/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Need the full KPI report?</h3>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Open reporting for deeper task, campaign, handover, office, and SLA breakdowns.</p>
            </div>
            <Link to="/reporting?pillar=tasks" className="inline-flex items-center justify-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-gc-orange/90">
              Open KPI Matrix
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {primaryMetrics.map((metric) => <PerformanceCard key={metric.label} metric={metric} />)}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondaryMetrics.map((metric) => <SmallMetric key={metric.label} metric={metric} />)}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Personal performance</h3>
            <p className="text-xs font-medium text-muted-foreground">Click any number to open the matching work directly.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {personalPerformanceLinks.map((metric) => <LinkedMetric key={metric.label} metric={metric} />)}
        </div>
      </section>

      {!isProfilePage && !targetUserName && (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Quick actions</h3>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Jump to the places people use most from performance review.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TOOL_LINKS.map((tool) => (
                <Link key={tool.to} to={tool.to} className="group flex min-h-10 items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-foreground hover:border-gc-orange">
                  <span className="flex items-center gap-2"><tool.icon size={15} className="text-gc-orange" />{tool.label}</span>
                  <ChevronRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {role === 'master' && !isProfilePage && !targetUserName && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-extrabold text-foreground">Team overview</h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Filter once, then review teams and agents in the same place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select label="Workspace" value={workspaceFilter} onChange={value => { setWorkspaceFilter(value as any); setTeamFilter('all'); setAgentFilter('all'); }}>
                <option value="all">All workspaces</option>
                <option value="operations">Operations</option>
                <option value="community">Community</option>
              </Select>
              <Select label="Team" value={teamFilter} onChange={value => { setTeamFilter(value); setAgentFilter('all'); }}>
                <option value="all">All teams</option>
                {insights.teamRows.map(row => <option key={row.team} value={row.team}>{row.team}</option>)}
              </Select>
              <Select label="Agent" value={agentFilter} onChange={setAgentFilter}>
                <option value="all">All agents</option>
                {insights.agentRows.map(row => <option key={row.name} value={row.name}>{row.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {insights.workspaceRows.map(row => (
              <button
                key={row.scope}
                onClick={() => { setWorkspaceFilter(row.scope || 'all'); setTeamFilter('all'); setAgentFilter('all'); }}
                className={cn(
                  'rounded-lg border bg-background p-4 text-left transition-colors hover:border-gc-orange',
                  workspaceFilter === row.scope ? 'border-gc-orange ring-2 ring-gc-orange/10' : 'border-border',
                )}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{row.name}</p>
                <p className="mt-2 text-2xl font-black text-foreground">{row.summary.tasks}</p>
                <p className="text-xs font-bold text-muted-foreground">{row.summary.done} done / {row.summary.blocked} blocked</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <PerformanceTable title="Teams" rows={filteredTeamRows} mode="team" onPick={(row) => setTeamFilter(row.team || 'all')} />
            <PerformanceTable title="Agents" rows={filteredAgentRows} mode="agent" onPick={(row) => setAgentFilter(row.name)} highlightName={agentFilter !== 'all' ? agentFilter : undefined} />
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-foreground">Offices</h4>
                <p className="mt-1 text-xs font-medium text-muted-foreground">Small regional snapshot for the active workspace.</p>
              </div>
              <Link to="/reporting?pillar=offices" className="inline-flex items-center gap-1 text-xs font-extrabold text-gc-orange hover:underline">
                Reports <ChevronRight size={13} />
              </Link>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {officeInsights.officeRows.map((row) => (
                <Link key={row.office} to={`/reporting?pillar=offices&office=${encodeURIComponent(row.office)}`} className="rounded-lg border border-border bg-card p-3 hover:border-gc-orange">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-foreground">{row.office}</p>
                    <MapPin className="h-3.5 w-3.5 text-gc-orange" />
                  </div>
                  <p className="mt-2 text-xl font-black text-foreground">{row.agents}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{row.tasks} tasks / {row.completionRate}% done</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!targetUserName && !isPerformancePage && <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gc-orange" />
            <h3 className="text-base font-extrabold text-foreground">Profile details</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name">
              <input className="settings-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </Field>
            <Field label="Office">
              <select className="settings-input" required value={office} onChange={(event) => setOffice(event.target.value as OpsOffice)}>
                {OPS_OFFICES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Title">
              <input className="settings-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Department">
              <select className="settings-input" value={department} onChange={(event) => setDepartment(event.target.value as OpsDepartment)}>
                {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <input className="settings-input" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">Profile details are saved through Supabase Auth, not a local credential store.</p>
            <button
              onClick={saveProfile}
              disabled={saving || !displayName.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gc-orange px-4 text-xs font-extrabold uppercase tracking-widest text-white hover:bg-gc-orange/90 disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-gc-orange" />
            <h3 className="text-base font-extrabold text-foreground">Password</h3>
          </div>
          <Field label="New password">
            <input
              className="settings-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </Field>
          <button
            onClick={savePassword}
            disabled={passwordSaving || password.length < 6}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-xs font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange disabled:opacity-60"
          >
            <KeyRound size={14} />
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </button>
          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}
        </section>
      </div>}
    </div>
  );
}

function uniqueOpsUsers(users: OpsUser[]): OpsUser[] {
  const byName = new Map<string, OpsUser>();
  users.forEach((user) => {
    const key = normalize(user.displayName);
    if (!key || byName.has(key)) return;
    byName.set(key, user);
  });
  return [...byName.values()];
}

const METRIC_TONE_CLASS: Record<ProfileMetric['tone'], string> = {
  green: 'text-emerald-600',
  orange: 'text-gc-orange',
  amber: 'text-amber-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
  sky: 'text-sky-600',
  indigo: 'text-indigo-600',
  neutral: 'text-foreground',
};

const METRIC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Done: CheckCircle2,
  'In Progress': Clock3,
  Pending: ListChecks,
  Blocked: CircleAlert,
};

function PerformanceCard({ metric }: { metric: ProfileMetric }) {
  const Icon = METRIC_ICON[metric.label] || BarChart3;
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{metric.label}</p>
          <p className={cn('mt-2 text-3xl font-black tabular-nums', METRIC_TONE_CLASS[metric.tone])}>{metric.value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-gc-orange">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SmallMetric({ metric }: { metric: ProfileMetric }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{metric.label}</p>
      <p className={cn('mt-1 text-xl font-black tabular-nums', METRIC_TONE_CLASS[metric.tone])}>{metric.value}</p>
    </div>
  );
}

function LinkedMetric({ metric }: { metric: LinkedProfileMetric }) {
  return (
    <Link to={metric.to} className="group rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-gc-orange hover:bg-gc-orange/5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{metric.label}</p>
        <ChevronRight size={13} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-gc-orange" />
      </div>
      <p className={cn('mt-2 text-2xl font-black tabular-nums', METRIC_TONE_CLASS[metric.tone])}>{metric.value}</p>
    </Link>
  );
}

function PerformanceTable({ title, rows, mode, onPick, highlightName }: { title: string; rows: PerformanceRow[]; mode: 'team' | 'agent'; onPick: (row: PerformanceRow) => void; highlightName?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h4 className="text-sm font-extrabold text-foreground">{title}</h4>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-muted-foreground">No performance rows match these filters.</div>
        ) : rows.slice(0, 12).map((row) => (
          <button key={`${mode}-${row.name}`} onClick={() => onPick(row)} className={cn('grid w-full gap-3 px-4 py-3 text-left hover:bg-muted/40 md:grid-cols-[1fr_5rem_5rem_5rem_5rem] md:items-center', highlightName && row.name === highlightName ? 'bg-gc-orange/5 ring-1 ring-inset ring-gc-orange/30' : '')}>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">{row.team || row.title || 'Workspace'}</p>
            </div>
            <Stat label="Tasks" value={row.summary.tasks} />
            <Stat label="Done" value={row.summary.done} />
            <Stat label="Blocked" value={row.summary.blocked} />
            <Stat label="Rate" value={`${row.summary.completionRate}%`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-left md:text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="min-w-40">
      <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select className="settings-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black capitalize text-foreground">{value}</p>
    </div>
  );
}
