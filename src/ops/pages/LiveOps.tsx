import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Flame, RadioTower, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { ATTACHED_EXPORT_USERS } from '../services/dataService';
import { dataService } from '../services/dataService';
import { buildOnlineUserRoster } from '../lib/onlineUsers';
import { buildLiveOpsInsights, getOperationalTaskStatus } from '../lib/opsPageInsights';
import { cn } from '../lib/utils';
import type { Task } from '../types';

type WindowKey = 'all' | 'today' | '7d' | '30d';

const WINDOW_LABELS: Record<WindowKey, string> = {
  all: 'All',
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
};

function withinWindow(value: number, window: WindowKey, now = Date.now()) {
  if (window === 'all') return true;
  const start = window === 'today'
    ? new Date(new Date(now).toDateString()).getTime()
    : now - (window === '7d' ? 7 : 30) * 86400000;
  return value >= start;
}

export default function LiveOps() {
  const { user } = useAuth();
  const [windowKey, setWindowKey] = useState<WindowKey>('7d');
  const campaigns = dataService.getCampaigns();
  const tasks = dataService.getTasks().filter((task) => withinWindow(task.updatedAt || task.createdAt, windowKey));
  const allTasks = dataService.getTasks();
  const handovers = dataService.getHandovers();
  const blockers = dataService.getBlockers().filter((blocker) => withinWindow(blocker.updatedAt || blocker.createdAt, windowKey));
  const insights = useMemo(() => buildLiveOpsInsights(campaigns, tasks, blockers), [blockers, campaigns, tasks]);
  const onlineRows = useMemo(() => buildOnlineUserRoster({
    users: [
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
      ...(user ? [user] : []),
    ],
    tasks: allTasks,
    handovers,
  }), [allTasks, handovers, user]);
  const onlineCount = onlineRows.filter((row) => row.status === 'online').length;
  const riskRows = campaigns
    .filter((campaign) => campaign.status === 'Blocked' || campaign.recordHealth !== 'Healthy')
    .sort((a, b) => (a.recordHealth === 'Critical' ? -1 : 1) - (b.recordHealth === 'Critical' ? -1 : 1))
    .slice(0, 8);
  const recentTasks = tasks.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 8);
  const ownerRows = buildOwnerRows(tasks);

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Live Ops</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Operations Pulse</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live donor-style command view for campaign health, task velocity, owners, and blockers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((item) => (
              <button key={item} onClick={() => setWindowKey(item)} className={cn('rounded-full px-3 py-1.5 text-xs font-bold', windowKey === item ? 'bg-gc-orange text-white' : 'border border-border text-muted-foreground hover:bg-accent')}>
                {WINDOW_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="Health Score" value={`${insights.healthScore}%`} detail="Lower when risks rise" icon={ShieldCheck} tone={insights.healthScore >= 80 ? 'green' : 'orange'} />
        <Metric title="Active Campaigns" value={insights.activeCampaigns} detail={`${insights.totalCampaigns} total`} icon={Activity} />
        <Metric title="Open Tasks" value={insights.openTasks} detail={`${insights.overdueTasks} overdue`} icon={RadioTower} tone="purple" />
        <Metric title="Online Users" value={onlineCount} detail={`${onlineRows.length} tracked`} icon={UsersRound} tone="green" />
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <QuickAction to="/campaigns" icon={BarChart3} title="Campaigns" detail="Open execution matrix" />
        <QuickAction to="/tasks-daily-routines" icon={CheckCircle2} title="Daily routine" detail="Clear focus queue" />
        <QuickAction to="/updates" icon={RadioTower} title="Updates" detail="Review latest movement" />
        <QuickAction to="/tasks" icon={UsersRound} title="All tasks" detail="Manage task board" />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-extrabold text-foreground">Risk Queue</h3>
          <p className="mt-1 text-xs text-muted-foreground">Campaigns that should be checked first.</p>
          <div className="mt-4 space-y-3">
            {riskRows.length ? riskRows.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{campaign.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{campaign.country || 'No market'} - {campaign.nextAction || 'No next action set'}</p>
                  </div>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', campaign.recordHealth === 'Critical' ? 'border-red-500/20 bg-red-500/10 text-red-600' : 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange')}>
                    {campaign.recordHealth}
                  </span>
                </div>
              </div>
            )) : <EmptyState label="No blocked or unhealthy campaigns." />}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-extrabold text-foreground">Status Breakdown</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(['Blocked', 'In Progress', 'Pending', 'Done'] as const).map((status) => {
              const count = tasks.filter((task) => getOperationalTaskStatus(task) === status).length;
              return <StatusTile key={status} label={status} value={count} total={tasks.length} />;
            })}
          </div>
          <h3 className="mt-6 text-sm font-extrabold text-foreground">Team Activity</h3>
          <div className="mt-3 space-y-2">
            {ownerRows.map((row) => (
              <div key={row.owner} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-foreground">{row.owner}</p>
                  <p className="text-[11px] text-muted-foreground">{row.done} done - {row.blocked} blocked</p>
                </div>
                <span className="text-sm font-black text-gc-orange">{row.total}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Online Users</h3>
            <p className="mt-1 text-xs text-muted-foreground">Captured from recent login, task updates, and handover activity.</p>
          </div>
          <Link to="/online-users" className="text-xs font-bold text-gc-orange hover:underline">Open full roster</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {onlineRows.slice(0, 6).map((row) => (
            <div key={row.name} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', row.status === 'online' ? 'bg-emerald-500' : row.status === 'idle' ? 'bg-amber-500' : 'bg-muted-foreground/40')} />
                <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{row.department || 'Workspace'} - {row.status}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-extrabold text-foreground">Recent Tasks</h3>
          <div className="mt-4 space-y-3">
            {recentTasks.length ? recentTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.campaignId || 'No campaign'} - {task.ownerId || 'Unassigned'}</p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{getOperationalTaskStatus(task)}</span>
                </div>
              </div>
            )) : <EmptyState label="No recent tasks in this window." />}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-extrabold text-foreground">Blocker Board</h3>
          <div className="mt-4 space-y-3">
            {blockers.filter((blocker) => blocker.status !== 'Resolved').slice(0, 8).map((blocker) => (
              <div key={blocker.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-gc-orange" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{blocker.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{blocker.impact} - Owner: {blocker.ownerId || 'Unassigned'}</p>
                  </div>
                </div>
              </div>
            ))}
            {insights.openBlockers === 0 && <EmptyState label="No open blockers." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildOwnerRows(tasks: Task[]) {
  const rows = new Map<string, { owner: string; total: number; done: number; blocked: number }>();
  tasks.forEach((task) => {
    const owner = task.ownerId || 'Unassigned';
    const row = rows.get(owner) || { owner, total: 0, done: 0, blocked: 0 };
    row.total += 1;
    if (getOperationalTaskStatus(task) === 'Done') row.done += 1;
    if (getOperationalTaskStatus(task) === 'Blocked') row.blocked += 1;
    rows.set(owner, row);
  });
  return [...rows.values()].sort((a, b) => b.total - a.total).slice(0, 6);
}

function QuickAction({ to, icon: Icon, title, detail }: { to: string; icon: React.ElementType; title: string; detail: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-gc-orange/40 hover:bg-gc-orange/5">
      <Icon size={18} className="text-gc-orange" />
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

function StatusTile({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground"><span>{label}</span><span>{pct}%</span></div>
      <p className="mt-3 text-2xl font-black text-foreground">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gc-orange" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Metric({ title, value, detail, icon: Icon, tone = 'orange' }: { title: string; value: number | string; detail: string; icon: React.ElementType; tone?: 'orange' | 'green' | 'red' | 'purple' }) {
  const tones = {
    orange: 'bg-gc-orange/10 text-gc-orange border-gc-orange/20',
    green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    purple: 'bg-gc-purple/10 text-gc-purple border-gc-purple/20',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{title}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', tones[tone])}><Icon size={17} /></div>
      </div>
      <p className="mt-4 text-3xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{label}</div>;
}
