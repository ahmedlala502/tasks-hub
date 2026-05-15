import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Handshake, ListChecks, Plus, Target } from 'lucide-react';
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
  const displayName = user?.displayName || 'Workspace User';
  const insights = useMemo(() => buildMyDashboardInsights(tasks, campaigns, displayName), [campaigns, displayName, tasks]);
  const myTasks = useMemo(() => {
    const byId = new Map<string, Task>();
    tasks.filter((task) => isAssignedToUser(task, displayName)).forEach((task) => byId.set(task.id, task));
    return Array.from(byId.values()).sort((a, b) => {
      const statusA = getOperationalTaskStatus(a);
      const statusB = getOperationalTaskStatus(b);
      if (statusA !== statusB) return statusA === 'Done' ? 1 : statusB === 'Done' ? -1 : 0;
      return (a.dueDate || 0) - (b.dueDate || 0);
    });
  }, [displayName, tasks]);
  const myHandovers = useMemo(() => handovers.filter((handover) => isHandoverForUser(handover, displayName)).slice(0, 6), [displayName, handovers]);
  const campaignMatrix = useMemo(() => buildMyCampaignMatrix(campaigns, tasks).filter((item) => insights.campaignNames.includes(item.campaign.name)).slice(0, 5), [campaigns, insights.campaignNames, tasks]);

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">My Dashboard</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Personal command view. Creation and edits stay in the dedicated Tasks, Handover, and Campaigns pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/tasks" className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-gc-orange/90">
              <Plus size={16} /> Task form
            </Link>
            <Link to="/handover" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-accent">
              <Handshake size={16} /> Handover form
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="My Tasks" value={insights.totalTasks} detail={`${insights.inProgressTasks} in progress`} icon={Target} />
        <Metric title="Done" value={insights.completedTasks} detail={`${insights.completionRate}% closed`} icon={CheckCircle2} tone="green" />
        <Metric title="Blocked" value={insights.blockedTasks} detail={`${insights.pendingTasks} pending`} icon={AlertCircle} tone="red" />
        <Metric title="Handovers" value={myHandovers.length} detail="Assigned to/from you" icon={Handshake} tone="purple" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">My Task Queue</h3>
              <p className="mt-1 text-xs text-muted-foreground">Every task assigned to you, without duplicate rows.</p>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-gc-orange hover:underline">Open Tasks</Link>
          </div>
          <div className="mt-4 space-y-3">
            {myTasks.length ? myTasks.slice(0, 12).map((task) => <TaskRow key={task.id} task={task} />) : <EmptyState label="No personal tasks assigned to you yet." />}
          </div>
        </section>

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
              <div key={handover.id} className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-bold text-foreground">{handover.team} - {handover.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">To {(handover.assignTo || []).join(', ') || handover.incomingLead || 'Unassigned'} - {handover.handoffDate}</p>
              </div>
            )) : <EmptyState label="No handovers assigned to or from you yet." />}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">My Campaign Progress</h3>
            <p className="mt-1 text-xs text-muted-foreground">Campaign buckets where you own work.</p>
          </div>
          <Link to="/campaigns" className="text-xs font-bold text-gc-orange hover:underline">Open Campaigns</Link>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {campaignMatrix.length ? campaignMatrix.map((item) => (
            <div key={item.campaign.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{item.campaign.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.taskCount} tasks - {item.blockedCount} blocked - {item.campaign.nextAction || 'No next action set'}</p>
                </div>
                <span className="text-sm font-black text-gc-orange">{item.progress}%</span>
              </div>
            </div>
          )) : <EmptyState label="No campaign-linked tasks assigned to you yet." />}
        </div>
      </section>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const status = getOperationalTaskStatus(task);
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{task.campaignId || 'No campaign'} - {task.nextStep || task.description || 'No next step'}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>{status}</span>
            <span>{task.priority}</span>
            <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
          </div>
        </div>
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
