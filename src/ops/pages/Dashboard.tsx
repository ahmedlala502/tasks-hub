/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { filterBlockersByRole, filterCampaignsByRole, filterHandoversByRole, filterInfluencersByRole, filterTasksByRole } from '../lib/workspace';
import { dataService } from '../services/dataService';
import { Button } from '../components/ui/button';
import { CampaignStage } from '../constants';
import { buildUpdatesFeed } from '../lib/opsPageInsights';

const STAGE_SHORT: Record<number, string> = {
  1: 'Intake', 2: 'Validation', 3: 'Blocked', 4: 'Ready',
  5: 'Setup', 6: 'List Prep', 7: 'Approval', 8: 'Invites',
  9: 'Reminder 1', 10: 'Reminder 2', 11: 'Confirmations',
  12: 'Scheduling', 13: 'Execution', 14: 'Coverage',
  15: 'Recovery', 16: 'QA Review', 17: 'Reporting', 18: 'Closure',
};

const TOTAL_STAGES = 18;

const STAGE_TO_BAR: Record<number, number> = {
  1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5,
  8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 7, 14: 8,
  15: 8, 16: 9, 17: 10, 18: 10,
};

const RADAR_LABELS = [
  'Intake', 'Validation', 'Ready', 'Setup', 'List Prep', 'Approval',
  'Invites', 'Execution', 'Coverage', 'QA Review', 'Closure',
];

type EmployeeProductivity = {
  name: string;
  assignedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  outgoingHandovers: number;
  incomingHandovers: number;
  acknowledgedHandovers: number;
  reviewedHandovers: number;
  score: number;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function HeaderWidget({
  label,
  value,
  detail,
  tone = 'neutral',
  active,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'green' | 'orange' | 'red' | 'purple';
  active?: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    neutral: {
      label: 'text-gray-500 dark:text-gray-400',
      value: 'text-gray-900 dark:text-white',
      border: 'border-gray-100 dark:border-gray-800',
      dot: '',
    },
    green: {
      label: 'text-green-600 dark:text-green-400',
      value: 'text-green-600 dark:text-green-400',
      border: 'border-gray-100 dark:border-gray-800',
      dot: 'bg-green-500',
    },
    orange: {
      label: 'text-gc-orange',
      value: 'text-gc-orange',
      border: 'border-gray-100 dark:border-gray-800',
      dot: '',
    },
    red: {
      label: 'text-red-500',
      value: 'text-red-500',
      border: 'border-red-100 dark:border-red-900/30',
      dot: '',
    },
    purple: {
      label: 'text-purple-600 dark:text-purple-400',
      value: 'text-purple-600 dark:text-purple-400',
      border: 'border-gray-100 dark:border-gray-800',
      dot: '',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white dark:bg-card rounded-xl p-4 border ${toneClasses.border} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left cursor-pointer`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 flex items-center ${toneClasses.label}`}>
        {active && <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${toneClasses.dot}`} />}
        {label}
      </p>
      <p className={`text-3xl font-bold leading-tight tabular-nums ${toneClasses.value}`}>{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">{detail}</p>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}

function MiniBadge({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: 'orange' | 'green' | 'purple' | 'red';
  onClick: () => void;
}) {
  const tones = {
    orange: 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-400',
    purple: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/30 dark:bg-purple-900/10 dark:text-purple-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-left transition-all hover:-translate-y-0.5 ${tones[tone]}`}
    >
      <span className="block text-[9px] font-bold uppercase tracking-[1.4px] opacity-80">{label}</span>
      <span className="mt-0.5 block text-[13px] font-black">{value}</span>
    </button>
  );
}

function EmployeeCard({
  employee,
  onTasksClick,
  onHandoverClick,
}: {
  employee: EmployeeProductivity;
  onTasksClick: () => void;
  onHandoverClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 hover:border-gc-orange/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-extrabold text-foreground">{employee.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">
            Productivity Score {employee.score}
          </p>
        </div>
        <button
          type="button"
          onClick={onTasksClick}
          className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[1.4px] text-foreground hover:border-gc-orange hover:text-gc-orange transition-colors"
        >
          Open
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniBadge label="Completed Tasks" value={employee.completedTasks.toString()} tone="green" onClick={onTasksClick} />
        <MiniBadge label="Assigned Tasks" value={employee.assignedTasks.toString()} tone="orange" onClick={onTasksClick} />
        <MiniBadge label="Handovers Sent" value={employee.outgoingHandovers.toString()} tone="purple" onClick={onHandoverClick} />
        <MiniBadge label="Reviewed" value={employee.reviewedHandovers.toString()} tone={employee.reviewedHandovers > 0 ? 'green' : 'purple'} onClick={onHandoverClick} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Risk Signal</span>
        <button
          type="button"
          onClick={employee.overdueTasks > 0 ? onTasksClick : onHandoverClick}
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[1.4px] ${
            employee.overdueTasks > 0
              ? 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300'
          }`}
        >
          {employee.overdueTasks > 0 ? `${employee.overdueTasks} overdue` : 'On track'}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const campaigns = filterCampaignsByRole(role, dataService.getCampaigns());
  const tasks = filterTasksByRole(role, dataService.getTasks());
  const influencers = filterInfluencersByRole(role, dataService.getInfluencers());
  const blockers = filterBlockersByRole(role, dataService.getBlockers());
  const handovers = filterHandoversByRole(role, dataService.getHandovers());
  const recentEvents = buildUpdatesFeed(campaigns, tasks, blockers, handovers).slice(0, 8);

  const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const atRiskCount = campaigns.filter(c => c.recordHealth && c.recordHealth !== 'Healthy').length;
  const coverageGap = influencers.filter(i => !i.coverageReceived).length;
  const openBlockers = blockers.filter(b => b.status === 'Open');
  const pendingHandovers = handovers.filter(h => h.status === 'Pending').length;
  const reviewedHandovers = handovers.filter(h => h.status === 'Reviewed').length;
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate < Date.now()).length;

  const latestHandovers = [...handovers]
    .sort((a, b) => {
      const aStamp = a.reviewedAt ?? a.acknowledgedAt ?? a.updatedAt;
      const bStamp = b.reviewedAt ?? b.acknowledgedAt ?? b.updatedAt;
      return bStamp - aStamp;
    })
    .slice(0, 5);

  const barCounts = Array(RADAR_LABELS.length).fill(0) as number[];
  campaigns.forEach(c => {
    const bar = STAGE_TO_BAR[c.stage];
    if (bar !== undefined) barCounts[bar]++;
  });
  const maxBar = Math.max(...barCounts, 1);
  const activeBarIndex = barCounts.indexOf(Math.max(...barCounts));

  const executionCount = campaigns.filter(
    c => c.stage >= CampaignStage.INVITATIONS_RUNNING && c.stage <= CampaignStage.MISSING_COVERAGE_RECOVERY,
  ).length;

  const employeeStatsMap = new Map<string, EmployeeProductivity>();
  const ensureEmployee = (name: string) => {
    const normalized = normalizeName(name);
    if (!employeeStatsMap.has(normalized)) {
      employeeStatsMap.set(normalized, {
        name: normalized,
        assignedTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        outgoingHandovers: 0,
        incomingHandovers: 0,
        acknowledgedHandovers: 0,
        reviewedHandovers: 0,
        score: 0,
      });
    }
    return employeeStatsMap.get(normalized)!;
  };

  tasks.forEach(task => {
    const employee = ensureEmployee(task.ownerId);
    employee.assignedTasks += 1;
    if (task.completed) employee.completedTasks += 1;
    if (!task.completed && task.dueDate < Date.now()) employee.overdueTasks += 1;
  });

  handovers.forEach(handover => {
    const outgoing = ensureEmployee(handover.outgoingLead ?? '');
    const incoming = ensureEmployee(handover.incomingLead ?? '');

    outgoing.outgoingHandovers += 1;
    incoming.incomingHandovers += 1;

    if (handover.status === 'Acknowledged' || handover.status === 'Reviewed') {
      incoming.acknowledgedHandovers += 1;
    }
    if (handover.status === 'Reviewed') {
      incoming.reviewedHandovers += 1;
    }
  });

  const employeeStats = Array.from(employeeStatsMap.values())
    .map(employee => ({
      ...employee,
      score:
        employee.completedTasks * 12 +
        employee.reviewedHandovers * 10 +
        employee.acknowledgedHandovers * 6 +
        employee.outgoingHandovers * 3 +
        employee.assignedTasks -
        employee.overdueTasks * 5,
    }))
    .sort((a, b) => b.score - a.score || b.completedTasks - a.completedTasks || a.overdueTasks - b.overdueTasks);

  const recentActivity = new Map<string, number>();
  tasks.forEach(task => {
    const owner = normalizeName(task.ownerId);
    recentActivity.set(owner, Math.max(recentActivity.get(owner) ?? 0, task.updatedAt));
  });
  handovers.forEach(handover => {
    const lastActiveAt = handover.reviewedAt ?? handover.acknowledgedAt ?? handover.updatedAt;
    [handover.outgoingLead ?? '', handover.incomingLead ?? ''].forEach(name => {
      const employee = normalizeName(name);
      recentActivity.set(employee, Math.max(recentActivity.get(employee) ?? 0, lastActiveAt));
    });
  });

  const onlineThreshold = Date.now() - 1000 * 60 * 60 * 12;
  const onlineEmployees = employeeStats.filter(employee => (recentActivity.get(employee.name) ?? 0) >= onlineThreshold).length;

  const topEmployees = employeeStats.slice(0, 4);
  const topPerformer = employeeStats[0];
  const handoverLeader = [...employeeStats].sort((a, b) => b.outgoingHandovers - a.outgoingHandovers || b.reviewedHandovers - a.reviewedHandovers)[0];
  const supportNeeded = [...employeeStats].sort((a, b) => b.overdueTasks - a.overdueTasks || a.completedTasks - b.completedTasks)[0];

  return (
    <div className="space-y-6 max-w-[1240px] mx-auto">
      <div className="relative overflow-hidden bg-white dark:bg-card rounded-xl p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gc-orange" />
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => navigate('/handover')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700 font-mono tracking-[0.2px] dark:bg-green-900/20 dark:border-green-900/40 dark:text-green-400"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Shift Relay
            </button>
            <button
              type="button"
              onClick={() => navigate('/tasks/pending')}
              className="px-2.5 py-1 rounded-full bg-secondary border border-border text-[10px] font-bold tracking-[0.2px] text-muted-foreground hover:border-gc-orange hover:text-gc-orange transition-colors"
            >
              {pendingTasks} pending tasks
            </button>
          </div>
          <h1 className="font-condensed font-black text-4xl md:text-5xl tracking-tight text-gray-900 dark:text-white leading-[1]">
            Operational<br />
            <span className="text-gc-orange">Heartbeat.</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed mt-1">
            Supervising <strong className="text-gray-900 dark:text-white">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</strong>,
            <strong className="text-gc-orange"> {totalTasks} task{totalTasks !== 1 ? 's' : ''}</strong> in the queue, and
            <strong className="text-gray-900 dark:text-white"> {onlineEmployees} employee{onlineEmployees !== 1 ? 's' : ''}</strong> active in the last 12 hours.
          </p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3 shrink-0">
          <Button
            onClick={() => navigate('/tasks/all')}
            className="bg-gc-orange hover:bg-gc-orange/90 text-white font-condensed font-bold tracking-wide text-sm gap-2"
          >
            <Activity className="h-4 w-4" />
            Review Tasks
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/handover')}
            className="border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800 font-condensed font-bold tracking-wide text-sm"
          >
            Shift Handover
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <HeaderWidget label="Employees Online" value={onlineEmployees.toLocaleString()} detail="Active within 12h" tone="green" active={onlineEmployees > 0} onClick={() => navigate('/online-users')} />
        <HeaderWidget label="All Campaigns" value={campaigns.length.toLocaleString()} detail="Portfolio load" onClick={() => navigate('/campaigns')} />
        <HeaderWidget label="Active Now" value={activeCampaigns.toLocaleString()} detail="Currently running" tone="orange" onClick={() => navigate('/analytics')} />
        <HeaderWidget label="All Tasks" value={totalTasks.toLocaleString()} detail="Open + completed" tone="purple" onClick={() => navigate('/tasks/all')} />
        <HeaderWidget label="Tasks Done" value={completedTasks.toLocaleString()} detail="Closed tasks" tone="green" active={completedTasks > 0} onClick={() => navigate('/tasks/done')} />
        <HeaderWidget label="Tasks Pending" value={pendingTasks.toLocaleString()} detail="Awaiting completion" tone="red" onClick={() => navigate('/tasks/pending')} />
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Workspace Event Recorder</p>
            <h3 className="font-condensed font-extrabold text-[17px] tracking-tight text-foreground">Latest Activity Across The Tool</h3>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold" onClick={() => navigate('/updates')}>
            Open Updates
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recentEvents.map((event) => (
            <button key={event.id} onClick={() => navigate(event.kind === 'handover' ? '/handover' : event.kind === 'task' ? '/tasks' : event.kind === 'campaign' ? '/campaigns' : '/live-ops')} className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-gc-orange/40 hover:bg-gc-orange/5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{event.kind}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">{timeAgo(event.at)}</span>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-foreground">{event.title}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{event.detail}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-5">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Status Panel</p>
                <h3 className="font-condensed font-extrabold text-[17px] tracking-tight text-foreground">Real Recent Handovers</h3>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold" onClick={() => navigate('/handover')}>
                Open Real Handovers
              </Button>
            </div>
            {latestHandovers.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No real handovers yet. <button onClick={() => navigate('/handover')} className="text-gc-orange font-semibold hover:underline">Create shift relay</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Relay</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Team / Region</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Linked Tasks</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {latestHandovers.map(handover => (
                      <tr
                        key={handover.id}
                        onClick={() => navigate('/handover')}
                        className="hover:bg-accent/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gc-orange/10 border border-gc-orange/20 flex items-center justify-center text-gc-orange group-hover:bg-gc-orange group-hover:text-white transition-all">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-foreground group-hover:text-gc-orange transition-colors">
                                {handover.outgoingLead ?? ''} to {handover.incomingLead ?? ''}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono uppercase">
                                {handover.handoffDate} · {handover.fromShift} to {handover.toShift}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="text-[12px] font-semibold text-foreground">{handover.team}</p>
                            <p className="text-[10px] text-muted-foreground">{handover.region}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <p className="text-[12px] font-semibold text-foreground tabular-nums">{handover.taskIds.length}</p>
                            <p className="text-[10px] text-muted-foreground">Task link{handover.taskIds.length !== 1 ? 's' : ''} carried over</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate('/handover');
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              handover.status === 'Reviewed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              handover.status === 'Acknowledged' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                              'bg-destructive/10 text-destructive border-destructive/20'
                            }`}
                          >
                            {handover.status}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-card border border-gray-100 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5 gap-4">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Stage Mapping</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Global Lifecycle Radar</h3>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold" onClick={() => navigate('/analytics')}>
                Performance View
              </Button>
            </div>
            <div className="flex items-end gap-[3px] h-20">
              {RADAR_LABELS.map((label, index) => {
                const count = barCounts[index];
                const heightPct = maxBar > 0 ? Math.max((count / maxBar) * 100, count > 0 ? 15 : 8) : 8;
                const isPeak = index === activeBarIndex && count > 0;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate('/analytics')}
                    className="flex-1 group cursor-pointer flex flex-col items-center justify-end h-full gap-1"
                    title={`${label}: ${count} campaign${count !== 1 ? 's' : ''}`}
                  >
                    <div
                      className={`w-1.5 rounded-full transition-all duration-500 group-hover:w-2.5 ${
                        isPeak ? 'bg-gc-orange shadow-[0_0_12px_rgba(232,99,12,0.5)]' : count > 0 ? 'bg-gc-purple/60' : 'bg-muted'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </button>
                );
              })}
            </div>
            {executionCount > 0 ? (
              <div className="mt-4 flex items-start gap-3 p-4 bg-orange-50 border border-orange-100 rounded-lg dark:bg-orange-900/10 dark:border-orange-900/30">
                <ShieldAlert className="h-4 w-4 text-gc-orange shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Relay obstruction:</strong> {executionCount} campaign{executionCount !== 1 ? 's' : ''} inside execution pressure.
                  {' '}
                  <button onClick={() => navigate('/handover')} className="text-gc-orange font-semibold hover:underline">Check handover coverage</button>
                </p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="mt-4 flex items-start gap-3 p-4 bg-muted/30 border border-border rounded-lg">
                <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground">No campaigns in the pipeline yet.</p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-lg dark:bg-green-900/10 dark:border-green-900/30">
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Pipeline clear:</strong> no campaign is jammed in active execution right now.
                </p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground mb-0.5">Employee Analysis</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Task & Handover Productivity Board</h3>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold" onClick={() => navigate('/handover')}>
                Relay Details
              </Button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MiniBadge label="Employees Tracked" value={employeeStats.length.toString()} tone="orange" onClick={() => navigate('/profile')} />
                <MiniBadge label="Online Now" value={onlineEmployees.toString()} tone="green" onClick={() => navigate('/online-users')} />
                <MiniBadge label="Tasks Completed" value={completedTasks.toString()} tone="green" onClick={() => navigate('/tasks/done')} />
                <MiniBadge label="Handovers Reviewed" value={reviewedHandovers.toString()} tone="purple" onClick={() => navigate('/handover')} />
                <MiniBadge label="Overdue Tasks" value={overdueTasks.toString()} tone={overdueTasks > 0 ? 'red' : 'green'} onClick={() => navigate('/tasks/blocked')} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/tasks/done')}
                  className="rounded-xl border border-border bg-background p-4 text-left hover:border-gc-orange/40 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Top Performer</p>
                  <p className="mt-2 text-[16px] font-extrabold text-foreground">{topPerformer?.name || 'No data yet'}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {topPerformer ? `${topPerformer.completedTasks} tasks closed with ${topPerformer.reviewedHandovers} reviewed handovers.` : 'Waiting for employee activity.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/handover')}
                  className="rounded-xl border border-border bg-background p-4 text-left hover:border-gc-orange/40 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Relay Anchor</p>
                  <p className="mt-2 text-[16px] font-extrabold text-foreground">{handoverLeader?.name || 'No data yet'}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {handoverLeader ? `${handoverLeader.outgoingHandovers} outgoing handovers keeping shift continuity stable.` : 'No handovers captured yet.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/tasks/blocked')}
                  className="rounded-xl border border-border bg-background p-4 text-left hover:border-gc-orange/40 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">Needs Support</p>
                  <p className="mt-2 text-[16px] font-extrabold text-foreground">{supportNeeded?.name || 'No data yet'}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {supportNeeded && supportNeeded.overdueTasks > 0 ? `${supportNeeded.overdueTasks} overdue task(s) should be rebalanced.` : 'No active support flags at the moment.'}
                  </p>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {topEmployees.map(employee => (
                  <EmployeeCard
                    key={employee.name}
                    employee={employee}
                    onTasksClick={() => navigate('/tasks/all')}
                    onHandoverClick={() => navigate('/handover')}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className="w-full bg-white dark:bg-card rounded-xl p-6 text-left text-foreground relative overflow-hidden group border border-purple-100 dark:border-purple-900/30 shadow-sm"
          >
            <div className="absolute top-0 right-0 p-6 text-purple-100 dark:text-purple-900/30 group-hover:rotate-12 transition-transform duration-700">
              <ShieldCheck className="h-28 w-28" strokeWidth={1} />
            </div>
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-purple-600 dark:text-purple-400 mb-1">Campaign Health</p>
            {campaigns.length > 0 ? (
              <>
                <p className="text-5xl font-condensed font-black tracking-tight text-purple-700 dark:text-purple-300 mb-3">
                  {Math.round((campaigns.filter(c => c.recordHealth === 'Healthy').length / campaigns.length) * 100)}
                  <span className="text-3xl text-purple-400">%</span>
                </p>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  {campaigns.filter(c => c.recordHealth === 'Healthy').length} of {campaigns.length} campaigns in healthy state.
                </p>
              </>
            ) : (
              <>
                <p className="text-5xl font-condensed font-black tracking-tight text-purple-700 dark:text-purple-300 mb-3">—</p>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">No campaigns to evaluate yet.</p>
              </>
            )}
          </button>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-destructive">Escalations</p>
                <h3 className="font-condensed font-extrabold text-[15px] text-foreground">Live Alert Log</h3>
              </div>
            </div>
            <div className="divide-y divide-border">
              {openBlockers.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No open blockers.</div>
              ) : (
                openBlockers.slice(0, 3).map(b => (
                  <button
                    key={b.id}
                    type="button"
                    className="w-full flex gap-3 items-start px-5 py-3.5 hover:bg-accent/40 cursor-pointer transition-colors text-left"
                    onClick={() => navigate('/blockers')}
                  >
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-[12.5px] font-semibold text-foreground truncate">{b.summary}</p>
                        <span className="text-[9.5px] font-mono text-muted-foreground shrink-0">{timeAgo(b.createdAt)}</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground font-mono">{b.id} · {normalizeName(b.ownerId)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full h-8 text-[11px] font-semibold" onClick={() => navigate('/blockers')}>
                View All Blockers {openBlockers.length > 0 && `(${openBlockers.length})`}
              </Button>
            </div>
          </div>

          <div
            onClick={() => navigate('/handover')}
            className="w-full bg-white dark:bg-card border border-border rounded-xl p-5 relative overflow-hidden shadow-sm text-left cursor-pointer"
          >
            <RefreshCw className="absolute -bottom-4 -right-4 h-20 w-20 text-gc-orange/10" />
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange mb-2">Shift Relay</p>
            <p className="font-condensed font-bold text-[15px] text-foreground leading-snug">
              {pendingHandovers} pending, {reviewedHandovers} fully reviewed.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniBadge label="Pending" value={pendingHandovers.toString()} tone={pendingHandovers > 0 ? 'red' : 'green'} onClick={() => navigate('/handover')} />
              <MiniBadge label="Acked" value={handovers.filter(h => h.status === 'Acknowledged').length.toString()} tone="orange" onClick={() => navigate('/handover')} />
              <MiniBadge label="Reviewed" value={reviewedHandovers.toString()} tone="green" onClick={() => navigate('/handover')} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/tasks/all')}
            className="w-full bg-white dark:bg-card border border-green-100 dark:border-green-900/30 rounded-xl p-5 relative overflow-hidden shadow-sm text-left"
          >
            <Activity className="absolute -bottom-3 -right-3 h-20 w-20 text-green-500/10" />
            <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-green-600 dark:text-green-400 mb-2">Task Velocity</p>
            {tasks.length > 0 ? (
              <>
                <p className="font-condensed font-bold text-[15px] text-foreground leading-snug">
                  {completedTasks} of {tasks.length} tasks completed.
                </p>
                <div className="mt-4 h-1.5 bg-green-50 dark:bg-green-900/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.round((completedTasks / tasks.length) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] text-green-600 dark:text-green-400 font-mono">
                    {Math.round((completedTasks / tasks.length) * 100)}% completion rate
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {overdueTasks} overdue
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-condensed font-bold text-[15px] text-foreground leading-snug">No tasks yet.</p>
                <div className="mt-4 h-1.5 bg-green-50 dark:bg-green-900/20 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
                </div>
                <p className="text-[10px] text-green-600 dark:text-green-400 font-mono mt-1.5">0% completion rate</p>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className="w-full rounded-xl border border-border bg-card p-5 text-left hover:border-gc-orange/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-muted-foreground">Workforce Snapshot</p>
                <h3 className="font-condensed font-extrabold text-[17px] text-foreground">Analysis Signals</h3>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-[11px] font-bold text-foreground">Tracked Employees</span>
                <span className="text-[11px] font-black text-gc-orange">{employeeStats.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-[11px] font-bold text-foreground">Employees With Reviewed Handover</span>
                <span className="text-[11px] font-black text-emerald-600">{employeeStats.filter(employee => employee.reviewedHandovers > 0).length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-[11px] font-bold text-foreground">Overdue Owners</span>
                <span className="text-[11px] font-black text-red-600">{employeeStats.filter(employee => employee.overdueTasks > 0).length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="text-[11px] font-bold text-foreground">Completion + Relay Leaders</span>
                <span className="flex items-center gap-1 text-[11px] font-black text-purple-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {employeeStats.filter(employee => employee.completedTasks > 0 && employee.outgoingHandovers > 0).length}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
