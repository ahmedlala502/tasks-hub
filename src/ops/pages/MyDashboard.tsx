import React, { useMemo } from 'react';
import { Activity, AlertCircle, CheckCircle2, Handshake, Plus, Target, UserCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { dataService } from '../services/dataService';
import { buildMyCampaignMatrix, buildMyDashboardInsights, getOperationalTaskStatus } from '../lib/opsPageInsights';
import { cn } from '../lib/utils';
import type { Handover, Task } from '../types';

function isAssignedToUser(task: Task, displayName: string) {
  const owner = task.ownerId?.toLowerCase() || '';
  const user = displayName.toLowerCase();
  return owner.includes(user) || user.includes(owner);
}

function isCreatedByUser(task: Task, displayName: string) {
  const creator = task.createdBy?.toLowerCase() || '';
  const user = displayName.toLowerCase();
  return creator.includes(user) || user.includes(creator);
}

function isHandoverForUser(handover: Handover, displayName: string) {
  const user = displayName.toLowerCase();
  return [...(handover.assignFrom || []), ...(handover.assignTo || []), handover.outgoingLead || '', handover.incomingLead || '']
    .some((name) => name && (name.toLowerCase().includes(user) || user.includes(name.toLowerCase())));
}

export default function MyDashboard() {
  const { user } = useAuth();
  const tasks = dataService.getTasks();
  const campaigns = dataService.getCampaigns();
  const handovers = dataService.getHandovers();
  const activityLogs = dataService.getActivityLogs();
  const displayName = user?.displayName || 'Workspace User';
  const userEmail = user?.email?.toLowerCase() || '';
  const userId = user?.uid || '';
  const insights = useMemo(() => buildMyDashboardInsights(tasks, campaigns, displayName), [campaigns, displayName, tasks]);

  const myAssignedTasks = useMemo(() => {
    const byId = new Map<string, Task>();
    tasks.filter((task) => isAssignedToUser(task, displayName)).forEach((task) => byId.set(task.id, task));
    return Array.from(byId.values()).sort((a, b) => {
      const statusA = getOperationalTaskStatus(a);
      const statusB = getOperationalTaskStatus(b);
      if (statusA !== statusB) return statusA === 'Done' ? 1 : statusB === 'Done' ? -1 : 0;
      return (a.dueDate || 0) - (b.dueDate || 0);
    });
  }, [displayName, tasks]);

  const myCreatedTasks = useMemo(() => {
    const byId = new Map<string, Task>();
    tasks.filter((task) => isCreatedByUser(task, displayName) && !isAssignedToUser(task, displayName)).forEach((task) => byId.set(task.id, task));
    return Array.from(byId.values()).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [displayName, tasks]);

  const myHandovers = useMemo(() => handovers.filter((handover) => isHandoverForUser(handover, displayName)).slice(0, 6), [displayName, handovers]);
  const campaignMatrix = useMemo(() => buildMyCampaignMatrix(campaigns, tasks).filter((item) => insights.campaignNames.includes(item.campaign.name)).slice(0, 5), [campaigns, insights.campaignNames, tasks]);
  const myActivity = useMemo(() => activityLogs.filter((event) => {
    const eventEmail = event.userEmail?.toLowerCase() || '';
    const eventName = event.userName?.toLowerCase() || '';
    const name = displayName.toLowerCase();
    return Boolean(
      (userId && event.userId === userId) ||
      (userEmail && eventEmail === userEmail) ||
      (name && eventName === name)
    );
  }).slice(0, 10), [activityLogs, displayName, userEmail, userId]);

  const performanceMetrics = useMemo(() => {
    const total = myAssignedTasks.length;
    const done = myAssignedTasks.filter((t) => t.completed).length;
    const blocked = myAssignedTasks.filter((t) => getOperationalTaskStatus(t) === 'Blocked').length;
    const inProgress = myAssignedTasks.filter((t) => getOperationalTaskStatus(t) === 'In Progress').length;
    const overdue = myAssignedTasks.filter((t) => !t.completed && t.dueDate && t.dueDate < Date.now()).length;
    const created = myCreatedTasks.length;
    return { total, done, blocked, inProgress, overdue, created };
  }, [myAssignedTasks, myCreatedTasks]);

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">My Dashboard</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Personal workspace — tasks assigned to and by you, performance summary, and campaign progress.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/tasks" className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-gc-orange/90">
              <Plus size={16} /> New Task
            </Link>
            <Link to="/handover" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent">
              <Handshake size={16} /> Handover form
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="My Tasks" value={insights.totalTasks} detail={`${performanceMetrics.inProgress} in progress · ${performanceMetrics.overdue} overdue`} icon={Target} />
        <Metric title="Done" value={performanceMetrics.done} detail={`${insights.completionRate}% completion rate`} icon={CheckCircle2} tone="green" />
        <Metric title="Blocked" value={performanceMetrics.blocked} detail={`${performanceMetrics.overdue} overdue tasks`} icon={AlertCircle} tone="red" />
        <Metric title="Assigned by Me" value={performanceMetrics.created} detail="Tasks I created for others" icon={UserPlus} tone="purple" />
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Performance Summary</h3>
            <p className="mt-1 text-xs text-muted-foreground">Your task metrics at a glance.</p>
          </div>
          <Link to="/tasks" className="text-xs font-bold text-gc-orange hover:underline">View All Tasks</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <PerfTile label="Total Assigned" value={performanceMetrics.total} />
          <PerfTile label="Completed" value={performanceMetrics.done} tone="green" />
          <PerfTile label="In Progress" value={performanceMetrics.inProgress} tone="blue" />
          <PerfTile label="Overdue" value={performanceMetrics.overdue} tone="red" />
          <PerfTile label="Tasks I Created" value={performanceMetrics.created} tone="purple" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">My Recent Activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">Actions saved under your account from any browser.</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gc-orange/20 bg-gc-orange/10 text-gc-orange">
            <Activity size={17} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {myActivity.length ? myActivity.map((event) => (
            <div key={event.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{event.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatActivityLabel(event.action)} - {event.entityType}</p>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{formatActivityTime(event.createdAt)}</span>
              </div>
            </div>
          )) : <EmptyState label="No saved account activity yet." />}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Assigned to Me</h3>
              <p className="mt-1 text-xs text-muted-foreground">Tasks others assigned to you.</p>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-gc-orange hover:underline">Open Tasks</Link>
          </div>
          <div className="mt-4 space-y-3">
            {myAssignedTasks.length ? myAssignedTasks.slice(0, 8).map((task) => (
              <Link key={task.id} to="/tasks" className="block rounded-lg border border-border bg-background p-4 hover:border-gc-orange/40 hover:bg-gc-orange/5 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.campaignId || 'No campaign'} - Created by {task.createdBy || 'Unknown'}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', statusColor(getOperationalTaskStatus(task)))}>
                    {getOperationalTaskStatus(task)}
                  </span>
                </div>
              </Link>
            )) : <EmptyState label="No tasks assigned to you yet." />}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Tasks I Assigned</h3>
              <p className="mt-1 text-xs text-muted-foreground">Tasks you created and assigned to others.</p>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-gc-orange hover:underline">Open Tasks</Link>
          </div>
          <div className="mt-4 space-y-3">
            {myCreatedTasks.length ? myCreatedTasks.slice(0, 8).map((task) => (
              <Link key={task.id} to="/tasks" className="block rounded-lg border border-border bg-background p-4 hover:border-gc-orange/40 hover:bg-gc-orange/5 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.campaignId || 'No campaign'} - Assigned to {task.ownerId || 'Unassigned'}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', statusColor(getOperationalTaskStatus(task)))}>
                    {getOperationalTaskStatus(task)}
                  </span>
                </div>
              </Link>
            )) : <EmptyState label="You haven't assigned any tasks yet." />}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Assigned Handovers</h3>
              <p className="mt-1 text-xs text-muted-foreground">Relay items involving you.</p>
            </div>
            <Link to="/handover" className="text-xs font-bold text-gc-orange hover:underline">Open Handover</Link>
          </div>
          <div className="mt-4 space-y-3">
            {myHandovers.length ? myHandovers.map((handover) => (
              <Link key={handover.id} to="/handover" className="block rounded-lg border border-border bg-background p-4 hover:border-gc-orange/40 hover:bg-gc-orange/5 transition-colors">
                <p className="text-sm font-bold text-foreground">{handover.team} - {handover.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">To {(handover.assignTo || []).join(', ') || handover.incomingLead || 'Unassigned'} - {handover.handoffDate}</p>
              </Link>
            )) : <EmptyState label="No handovers assigned to or from you yet." />}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">My Campaign Progress</h3>
              <p className="mt-1 text-xs text-muted-foreground">Campaign buckets where you own work.</p>
            </div>
            <Link to="/campaigns" className="text-xs font-bold text-gc-orange hover:underline">Open Campaigns</Link>
          </div>
          <div className="mt-4 space-y-3">
            {campaignMatrix.length ? campaignMatrix.map((item) => (
              <Link key={item.campaign.id} to={`/campaigns/${item.campaign.id}`} className="block rounded-lg border border-border bg-background p-4 hover:border-gc-orange/40 hover:bg-gc-orange/5 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.campaign.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.taskCount} tasks - {item.blockedCount} blocked - {item.campaign.nextAction || 'No next action set'}</p>
                  </div>
                  <span className="text-sm font-black text-gc-orange">{item.progress}%</span>
                </div>
              </Link>
            )) : <EmptyState label="No campaign-linked tasks assigned to you yet." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'Done': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600';
    case 'Blocked': return 'border-red-500/20 bg-red-500/10 text-red-600';
    case 'In Progress': return 'border-blue-500/20 bg-blue-500/10 text-blue-600';
    default: return 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange';
  }
}

function PerfTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'blue' | 'red' | 'purple' }) {
  const colors: Record<string, string> = {
    default: 'text-foreground',
    green: 'text-emerald-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    purple: 'text-gc-purple',
  };
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-black ${colors[tone]}`}>{value}</p>
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

function formatActivityLabel(action: string) {
  return action.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' ')).join(' ');
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
