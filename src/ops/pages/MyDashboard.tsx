import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, Bot, CheckCircle2, Handshake, Plus, Target, UserPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { dataService } from '../services/dataService';
import { buildMyCampaignMatrix, buildMyDashboardInsights, getOperationalTaskStatus } from '../lib/opsPageInsights';
import { getPersonalWork } from '../lib/personalWork';
import { getTaskManagerPath, getTaskRecordPath } from '../lib/taskRoutes';
import { cn } from '../lib/utils';
import { notify } from '../services/notificationService';
import type { Handover, Task } from '../types';

type WorkTab = 'assigned' | 'done' | 'created' | 'handovers';
const WORK_TABS: Array<{ id: WorkTab; label: string }> = [
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'done', label: 'Completed by me' },
  { id: 'created', label: 'Assigned by me' },
  { id: 'handovers', label: 'My handovers' },
];
const TASK_STATUS_OPTIONS: Array<NonNullable<Task['status']>> = ['Pending', 'In Progress', 'Blocked', 'Done'];

function taskPath(task: Pick<Task, 'id' | 'completed'>) {
  return getTaskRecordPath(task.id);
}

function handoverPath(handover: Pick<Handover, 'id'>) {
  return `/handover?handover=${encodeURIComponent(handover.id)}`;
}

function isHandoverRecipient(handover: Handover, displayName: string) {
  const user = displayName.trim().toLowerCase();
  if (!user) return false;
  return [...(handover.assignTo || []), handover.incomingLead || ''].some((name) => {
    const normalized = name.trim().toLowerCase();
    return normalized && (normalized === user || normalized.includes(user) || user.includes(normalized));
  });
}

function activityPath(event: { entityType: string; entityId: string | null; metadata?: Record<string, unknown> }) {
  const id = event.entityId || '';
  const metadataId = typeof event.metadata?.id === 'string' ? event.metadata.id : '';
  const campaignId = typeof event.metadata?.campaignId === 'string' ? event.metadata.campaignId : '';
  switch (event.entityType) {
    case 'task':
      return getTaskRecordPath(id || metadataId);
    case 'handover':
      return `/handover?handover=${encodeURIComponent(id || metadataId)}`;
    case 'campaign':
      return id || campaignId ? `/campaigns/${encodeURIComponent(id || campaignId)}` : '/campaigns';
    case 'influencer':
      return id ? `/influencers/${encodeURIComponent(id)}` : '/influencers';
    case 'workspace':
      return '/settings';
    case 'page':
      return id || '/';
    default:
      return '/my-dashboard';
  }
}

export default function MyDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(() => dataService.getTasks());
  const [handovers, setHandovers] = useState<Handover[]>(() => dataService.getHandovers());
  const campaigns = dataService.getCampaigns();
  const activityLogs = dataService.getActivityLogs();
  const displayName = user?.displayName || 'Workspace User';
  const userEmail = user?.email?.toLowerCase() || '';
  const userId = user?.uid || '';
  const insights = useMemo(() => buildMyDashboardInsights(tasks, campaigns, displayName), [campaigns, displayName, tasks]);
  const personalWork = useMemo(() => getPersonalWork(displayName, tasks, handovers), [displayName, handovers, tasks]);
  const requestedTab = searchParams.get('tab') as WorkTab | null;
  const activeTab = WORK_TABS.some((tab) => tab.id === requestedTab) ? requestedTab! : 'assigned';

  const myAssignedTasks = personalWork.assignedTasks;
  const myDoneTasks = personalWork.completedTasks;
  const myCreatedTasks = personalWork.createdTasks;
  const myHandovers = personalWork.handovers;

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

  const todayWork = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTime = startOfToday.getTime();
    const items = [
      ...myAssignedTasks.filter((task) => (task.updatedAt || task.createdAt || 0) >= startTime),
      ...myCreatedTasks.filter((task) => (task.updatedAt || task.createdAt || 0) >= startTime),
    ];
    const byId = new Map<string, Task>();
    items.forEach((task) => byId.set(task.id, task));
    return [...byId.values()].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 8);
  }, [myAssignedTasks, myCreatedTasks]);

  const performanceMetrics = useMemo(() => {
    const total = myAssignedTasks.length + myDoneTasks.length;
    const done = myDoneTasks.length;
    const blocked = myAssignedTasks.filter((t) => getOperationalTaskStatus(t) === 'Blocked').length;
    const inProgress = myAssignedTasks.filter((t) => getOperationalTaskStatus(t) === 'In Progress').length;
    const overdue = myAssignedTasks.filter((t) => !t.completed && t.dueDate && t.dueDate < Date.now()).length;
    const created = myCreatedTasks.length;
    return { total, done, blocked, inProgress, overdue, created };
  }, [myAssignedTasks, myCreatedTasks, myDoneTasks.length]);

  const chooseTab = (tab: WorkTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const updateTaskStatus = (task: Task, status: NonNullable<Task['status']>) => {
    const updated = dataService.updateTask(task.id, {
      status,
      completed: status === 'Done',
      completedAt: status === 'Done' ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    setTasks(updated);
    notify('Task Updated', `"${task.title}" moved to ${status}`, status === 'Done' ? 'green' : 'orange', taskPath(task));
  };

  const acknowledgeHandover = (handover: Handover) => {
    const nextStatus = handover.status === 'Pending' ? 'Acknowledged' : 'Reviewed';
    const updated = dataService.updateHandover(handover.id, {
      status: nextStatus,
      acknowledgedAt: nextStatus === 'Acknowledged' ? Date.now() : handover.acknowledgedAt,
      reviewedAt: nextStatus === 'Reviewed' ? Date.now() : handover.reviewedAt,
    });
    setHandovers(updated);
    notify('Handover Updated', `${handover.team} handover marked ${nextStatus.toLowerCase()}`, 'green', handoverPath(handover));
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">My Work</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Personal workspace for assigned tasks, completed work, delegated tasks, and handovers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={getTaskManagerPath()} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-gc-orange/90">
              <Plus size={16} /> New Task
            </Link>
            <Link to="/handover" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent">
              <Handshake size={16} /> Handover form
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">My Work Summary</h3>
            <p className="mt-1 text-xs text-muted-foreground">One clean view of your assigned, completed, blocked, and delegated work.</p>
          </div>
          <Link to={getTaskManagerPath()} className="text-xs font-bold text-gc-orange hover:underline">View All Tasks</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric title="Assigned" value={performanceMetrics.total} detail={`${performanceMetrics.inProgress} in progress`} icon={Target} />
          <Metric title="Done" value={performanceMetrics.done} detail={`${insights.completionRate}% completion`} icon={CheckCircle2} tone="green" />
          <Metric title="Blocked" value={performanceMetrics.blocked} detail={`${performanceMetrics.overdue} overdue`} icon={AlertCircle} tone="red" />
          <Metric title="Assigned by Me" value={performanceMetrics.created} detail="Delegated tasks" icon={UserPlus} tone="purple" />
          <Metric title="Handovers" value={myHandovers.length} detail="To or from you" icon={Handshake} tone="purple" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">My Work Queue</h3>
            <p className="mt-1 text-xs text-muted-foreground">Open your own workload directly and update progress without leaving this page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORK_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => chooseTab(tab.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  activeTab === tab.id
                    ? 'border-gc-orange bg-gc-orange/10 text-gc-orange'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'assigned' && (
            <PersonalTaskList
              emptyLabel="No active tasks assigned to you yet."
              tasks={myAssignedTasks}
              mode="assigned"
              onStatusChange={updateTaskStatus}
            />
          )}
          {activeTab === 'done' && (
            <PersonalTaskList
              emptyLabel="No completed tasks captured for you yet."
              tasks={myDoneTasks}
              mode="done"
              onStatusChange={updateTaskStatus}
            />
          )}
          {activeTab === 'created' && (
            <PersonalTaskList
              emptyLabel="You have not assigned any tasks yet."
              tasks={myCreatedTasks}
              mode="created"
              onStatusChange={updateTaskStatus}
            />
          )}
          {activeTab === 'handovers' && (
            <PersonalHandoverList
              emptyLabel="No handovers assigned to or from you yet."
              handovers={myHandovers}
              displayName={displayName}
              onProgress={acknowledgeHandover}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Today I Worked On</h3>
            <p className="mt-1 text-xs text-muted-foreground">Concrete tasks touched today, with creator and assignee context.</p>
          </div>
          <Link to="/analytics" className="inline-flex items-center gap-1.5 text-xs font-bold text-gc-orange hover:underline">
            <Bot size={14} /> Go Deeper
          </Link>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {todayWork.length ? todayWork.map((task) => (
            <Link key={task.id} to={taskPath(task)} className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-gc-orange/40 hover:bg-gc-orange/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creator {task.createdBy || 'Unknown'} - Assigned to {task.ownerId || 'Unassigned'}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', statusColor(getOperationalTaskStatus(task)))}>
                  {getOperationalTaskStatus(task)}
                </span>
              </div>
            </Link>
          )) : <EmptyState label="No task changes captured for today yet." />}
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
            <Link key={event.id} to={activityPath(event)} className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-gc-orange/40 hover:bg-gc-orange/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{event.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatActivityLabel(event.action)} - {event.entityType}</p>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{formatActivityTime(event.createdAt)}</span>
              </div>
            </Link>
          )) : <EmptyState label="No saved account activity yet." />}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5">
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

function PersonalTaskList({
  tasks,
  mode,
  emptyLabel,
  onStatusChange,
}: {
  tasks: Task[];
  mode: 'assigned' | 'done' | 'created';
  emptyLabel: string;
  onStatusChange: (task: Task, status: NonNullable<Task['status']>) => void;
}) {
  if (!tasks.length) return <EmptyState label={emptyLabel} />;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="hidden grid-cols-[1.3fr_0.8fr_0.75fr_0.7fr_0.95fr] border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:grid">
        <span>Task</span>
        <span>{mode === 'created' ? 'Assigned to' : 'Created by'}</span>
        <span>Campaign</span>
        <span>Due</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => {
          const status = getOperationalTaskStatus(task) as NonNullable<Task['status']>;
          return (
            <div key={task.id} className="grid gap-3 bg-background px-4 py-4 lg:grid-cols-[1.3fr_0.8fr_0.75fr_0.7fr_0.95fr] lg:items-center">
              <Link to={taskPath(task)} className="min-w-0 hover:text-gc-orange">
                <p className="truncate text-sm font-extrabold text-foreground">{task.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description || task.nextStep || 'No description saved.'}</p>
              </Link>
              <p className="text-xs font-bold text-muted-foreground">{mode === 'created' ? task.ownerId || 'Unassigned' : task.createdBy || 'Unknown'}</p>
              <p className="truncate text-xs font-bold text-muted-foreground">{task.campaignId || 'No campaign'}</p>
              <p className="text-xs font-bold text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</p>
              <div className="flex items-center gap-2">
                <select
                  className="settings-input h-9 min-w-36 text-xs font-bold"
                  value={status}
                  onChange={(event) => onStatusChange(task, event.target.value as NonNullable<Task['status']>)}
                >
                  {TASK_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <span className={cn('hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase xl:inline-flex', statusColor(status))}>
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonalHandoverList({
  handovers,
  emptyLabel,
  displayName,
  onProgress,
}: {
  handovers: Handover[];
  emptyLabel: string;
  displayName: string;
  onProgress: (handover: Handover) => void;
}) {
  if (!handovers.length) return <EmptyState label={emptyLabel} />;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="hidden grid-cols-[1fr_0.9fr_0.9fr_0.7fr_0.8fr] border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:grid">
        <span>Handover</span>
        <span>From</span>
        <span>To</span>
        <span>Date</span>
        <span>Action</span>
      </div>
      <div className="divide-y divide-border">
        {handovers.map((handover) => (
          <div key={handover.id} className="grid gap-3 bg-background px-4 py-4 lg:grid-cols-[1fr_0.9fr_0.9fr_0.7fr_0.8fr] lg:items-center">
            <Link to={handoverPath(handover)} className="min-w-0 hover:text-gc-orange">
              <p className="truncate text-sm font-extrabold text-foreground">{handover.team}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{handover.notes || 'No handover notes saved.'}</p>
            </Link>
            <p className="text-xs font-bold text-muted-foreground">{(handover.assignFrom || []).join(', ') || handover.outgoingLead || 'Unknown'}</p>
            <p className="text-xs font-bold text-muted-foreground">{(handover.assignTo || []).join(', ') || handover.incomingLead || 'Unassigned'}</p>
            <p className="text-xs font-bold text-muted-foreground">{handover.handoffDate}</p>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', handover.status === 'Reviewed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-gc-purple/20 bg-gc-purple/10 text-gc-purple')}>
                {handover.status}
              </span>
              {isHandoverRecipient(handover, displayName) && handover.status !== 'Reviewed' && (
                <button onClick={() => onProgress(handover)} className="rounded-lg bg-gc-orange px-3 py-2 text-[11px] font-bold text-white hover:bg-gc-orange/90">
                  {handover.status === 'Pending' ? 'Acknowledge' : 'Review'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
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
