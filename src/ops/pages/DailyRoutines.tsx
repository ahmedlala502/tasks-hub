import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit3,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Save,
  Search,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../App';
import { dataService } from '../services/dataService';
import { canEditTaskRecord } from '../lib/workspace';
import { getDefaultPlatformUserNames, loadPlatformUserNames, sortUniqueUserNames } from '../lib/platformUsers';
import { getOperationalTaskStatus } from '../lib/opsPageInsights';
import { isTaskAssignedToUser, isTaskCreatedByUser } from '../lib/personalWork';
import {
  filterDailyRoutineStats,
  type DailyRoutineOverviewFilter,
  type DailyRoutineOverviewView,
  type DailyRoutineUserStats,
} from '../lib/dailyRoutines';
import { TASK_MANAGER_LABEL, getTaskManagerPath } from '../lib/taskRoutes';
import { cn } from '../lib/utils';
import { notify } from '../services/notificationService';
import type { Campaign, Handover, Task } from '../types';

type TaskDraft = {
  id?: string;
  title: string;
  ownerId: string;
  campaignId: string;
  department: string;
  priority: Task['priority'];
  status: NonNullable<Task['status']>;
  dueDate: string;
  nextStep: string;
};

const EMPTY_DRAFT: TaskDraft = {
  title: '',
  ownerId: '',
  campaignId: '',
  department: 'PMO',
  priority: 'Medium',
  status: 'In Progress',
  dueDate: new Date().toISOString().slice(0, 10),
  nextStep: '',
};

const BUCKET_FILTERS: Record<string, DailyRoutineOverviewFilter> = {
  all: 'with-tasks',
  new: 'with-tasks',
  done: 'done',
  pending: 'pending',
  blocked: 'blocked',
  overdue: 'overdue',
  'in-progress': 'in-progress',
};

const BUCKET_STATUS_FILTERS: Record<string, string> = {
  done: 'Done',
  pending: 'Pending',
  blocked: 'Blocked',
  'in-progress': 'In Progress',
};

const WORK_FILTER_LABELS: Record<string, string> = {
  assigned: 'Assigned to',
  created: 'Assigned by',
  done: 'Completed by',
  blocked: 'Blocked for',
  all: 'All work for',
};

function draftFromTask(task: Task): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    ownerId: task.ownerId || '',
    campaignId: task.campaignId || '',
    department: task.department || task.category || 'PMO',
    priority: task.priority,
    status: getOperationalTaskStatus(task),
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    nextStep: task.nextStep || task.description || '',
  };
}

function collectUserNames(tasks: Task[], handovers: Handover[], platformUsers: string[]): string[] {
  const names: Array<string | undefined | null> = [...platformUsers];
  tasks.forEach(t => names.push(t.ownerId));
  handovers.forEach(h => {
    h.assignFrom?.forEach(n => names.push(n));
    h.assignTo?.forEach(n => names.push(n));
    names.push(h.outgoingLead, h.incomingLead);
  });
  return sortUniqueUserNames(names);
}

function getUserStats(name: string, tasks: Task[], handovers: Handover[]): DailyRoutineUserStats {
  const userTasks = tasks.filter(t => t.ownerId?.toLowerCase() === name.toLowerCase());
  const done = userTasks.filter(t => getOperationalTaskStatus(t) === 'Done').length;
  const inProgress = userTasks.filter(t => getOperationalTaskStatus(t) === 'In Progress').length;
  const pending = userTasks.filter(t => getOperationalTaskStatus(t) === 'Pending').length;
  const blocked = userTasks.filter(t => getOperationalTaskStatus(t) === 'Blocked').length;
  const overdue = userTasks.filter(t => !t.completed && t.dueDate && t.dueDate < Date.now()).length;
  const handoversAsTo = handovers.filter(h => (h.assignTo || []).some(n => n.toLowerCase() === name.toLowerCase())).length;
  const handoversAsFrom = handovers.filter(h => (h.assignFrom || []).some(n => n.toLowerCase() === name.toLowerCase())).length;
  const total = userTasks.length;
  return {
    name,
    totalTasks: total,
    doneTasks: done,
    inProgressTasks: inProgress,
    pendingTasks: pending,
    blockedTasks: blocked,
    overdueTasks: overdue,
    handoversAsTo,
    handoversAsFrom,
    totalHandovers: handoversAsTo + handoversAsFrom,
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

const STATUS_ORDER = ['Blocked', 'In Progress', 'Pending', 'Done'] as const;

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  Done:        { label: 'Done',        bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  'In Progress':{ label: 'In Progress', bg: 'bg-blue-50 dark:bg-blue-900/10',     text: 'text-blue-700 dark:text-blue-300',       border: 'border-blue-200 dark:border-blue-800',       dot: 'bg-blue-500'    },
  Pending:     { label: 'Pending',      bg: 'bg-amber-50 dark:bg-amber-900/10',   text: 'text-amber-700 dark:text-amber-300',     border: 'border-amber-200 dark:border-amber-800',     dot: 'bg-amber-500'   },
  Blocked:     { label: 'Blocked',      bg: 'bg-red-50 dark:bg-red-900/10',       text: 'text-red-700 dark:text-red-300',         border: 'border-red-200 dark:border-red-800',         dot: 'bg-red-500'     },
};

const PRIORITY_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Critical: { label: 'Critical', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
  High:     { label: 'High',     bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Medium:   { label: 'Medium',   bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  },
  Low:      { label: 'Low',      bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
};

export default function DailyRoutines() {
  const { role, user } = useAuth();
  const { bucket } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(dataService.getTasks());
  const [handovers] = useState<Handover[]>(dataService.getHandovers());
  const [campaigns] = useState<Campaign[]>(dataService.getCampaigns());
  const [platformUsers, setPlatformUsers] = useState<string[]>(getDefaultPlatformUserNames());
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [detailTab, setDetailTab] = useState<'tasks' | 'handovers'>('tasks');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [overviewView, setOverviewView] = useState<DailyRoutineOverviewView>('widgets');
  const [overviewFilter, setOverviewFilter] = useState<DailyRoutineOverviewFilter>('all');

  useEffect(() => {
    let alive = true;
    loadPlatformUserNames().then(users => {
      if (alive) setPlatformUsers(users);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const allUserNames = useMemo(() => collectUserNames(tasks, handovers, platformUsers), [tasks, handovers, platformUsers]);

  const allStats = useMemo(() => {
    const stats = new Map<string, DailyRoutineUserStats>();
    allUserNames.forEach(name => stats.set(name.toLowerCase(), getUserStats(name, tasks, handovers)));
    return stats;
  }, [allUserNames, tasks, handovers]);

  const overviewStats = useMemo(() =>
    allUserNames
      .map(n => allStats.get(n.toLowerCase())!)
      .sort((a, b) => b.totalTasks - a.totalTasks),
    [allUserNames, allStats],
  );

  const filteredStats = useMemo(() =>
    filterDailyRoutineStats(overviewStats, query, overviewFilter),
    [overviewStats, query, overviewFilter],
  );

  const selectedStats = selectedUser ? allStats.get(selectedUser.toLowerCase()) : null;
  const workFilter = searchParams.get('work') || 'assigned';

  const selectedUserTasks = useMemo(() => {
    if (!selectedUser) return [];
    return tasks
      .filter((task) => {
        if (workFilter === 'created') return isTaskCreatedByUser(task, selectedUser);
        if (workFilter === 'done') return isTaskAssignedToUser(task, selectedUser) && getOperationalTaskStatus(task) === 'Done';
        if (workFilter === 'blocked') return isTaskAssignedToUser(task, selectedUser) && getOperationalTaskStatus(task) === 'Blocked';
        if (workFilter === 'all') return isTaskAssignedToUser(task, selectedUser) || isTaskCreatedByUser(task, selectedUser);
        return isTaskAssignedToUser(task, selectedUser);
      })
      .sort((a, b) => {
        const ao = STATUS_ORDER.indexOf(getOperationalTaskStatus(a) as typeof STATUS_ORDER[number]);
        const bo = STATUS_ORDER.indexOf(getOperationalTaskStatus(b) as typeof STATUS_ORDER[number]);
        if (ao !== bo) return ao - bo;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      });
  }, [selectedUser, tasks, workFilter]);

  const filteredDetailTasks = useMemo(() => {
    if (statusFilter === 'all') return selectedUserTasks;
    return selectedUserTasks.filter(t => getOperationalTaskStatus(t) === statusFilter);
  }, [selectedUserTasks, statusFilter]);

  const selectedUserHandovers = useMemo(() => {
    if (!selectedUser) return [];
    return handovers.filter(h =>
      (h.assignFrom || []).some(n => n.toLowerCase() === selectedUser.toLowerCase()) ||
      (h.assignTo || []).some(n => n.toLowerCase() === selectedUser.toLowerCase()) ||
      h.outgoingLead?.toLowerCase() === selectedUser.toLowerCase() ||
      h.incomingLead?.toLowerCase() === selectedUser.toLowerCase(),
    );
  }, [selectedUser, handovers]);

  const assignmentOptions = useMemo(
    () => sortUniqueUserNames([...platformUsers, user?.displayName]),
    [platformUsers, user?.displayName],
  );

  const canEditTask = (task: Task) => canEditTaskRecord(role, user?.displayName, task, user?.email);

  useEffect(() => {
    const normalizedBucket = bucket?.toLowerCase();
    if (normalizedBucket && BUCKET_FILTERS[normalizedBucket]) {
      setOverviewFilter(BUCKET_FILTERS[normalizedBucket]);
      setStatusFilter(BUCKET_STATUS_FILTERS[normalizedBucket] || 'all');
    }

    const taskId = searchParams.get('task');
    const requestedUser = searchParams.get('user');
    if (taskId) {
      const task = tasks.find((item) => item.id === taskId);
      if (task?.ownerId) {
        setSelectedUser(task.ownerId);
        setDetailTab('tasks');
        setStatusFilter(getOperationalTaskStatus(task));
      }
      return;
    }

    if (requestedUser) {
      setSelectedUser(requestedUser);
      setDetailTab('tasks');
      const requestedWork = searchParams.get('work');
      if (requestedWork === 'done') setStatusFilter('Done');
      else if (requestedWork === 'blocked') setStatusFilter('Blocked');
      else setStatusFilter('all');
      return;
    }

    setSelectedUser(null);
  }, [bucket, searchParams, tasks]);

  const openUser = (name: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('user', name);
    next.delete('task');
    setSearchParams(next);
    setSelectedUser(name);
    setDetailTab('tasks');
  };

  const closeUser = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('user');
    next.delete('task');
    setSearchParams(next);
    setSelectedUser(null);
    setDetailTab('tasks');
    setStatusFilter(BUCKET_STATUS_FILTERS[bucket?.toLowerCase() || ''] || 'all');
  };

  const totals = useMemo(() => {
    let totalTasks = 0, totalDone = 0, totalInProgress = 0, totalPending = 0, totalBlocked = 0;
    overviewStats.forEach(s => {
      totalTasks += s.totalTasks;
      totalDone += s.doneTasks;
      totalInProgress += s.inProgressTasks;
      totalPending += s.pendingTasks;
      totalBlocked += s.blockedTasks;
    });
    return { totalUsers: overviewStats.length, totalTasks, totalDone, totalInProgress, totalPending, totalBlocked };
  }, [overviewStats]);

  const saveTask = () => {
    if (!draft?.title.trim()) return;
    const now = Date.now();
    const existing = draft.id ? tasks.find(t => t.id === draft.id) : undefined;
    if (existing && !canEditTask(existing)) {
      notify('View Only', 'Only the assigned user or admin can edit this task.', 'orange', getTaskManagerPath());
      setDraft(null);
      return;
    }
    const task: Task = {
      id: draft.id || `daily-task-${now}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      createdBy: existing?.createdBy || user?.displayName || 'Workspace User',
      title: draft.title.trim(),
      description: draft.nextStep.trim(),
      nextStep: draft.nextStep.trim(),
      ownerId: draft.ownerId,
      campaignId: draft.campaignId,
      department: draft.department,
      category: draft.department,
      priority: draft.priority,
      status: draft.status,
      dueDate: new Date(`${draft.dueDate}T18:00:00`).getTime(),
      completed: draft.status === 'Done',
      completedAt: draft.status === 'Done' ? now : undefined,
      flags: draft.status === 'Blocked' ? [{ id: `daily-flag-${now}`, label: 'Blocked', tone: 'red', resolved: false }] : [],
    };
    setTasks(draft.id ? dataService.updateTask(draft.id, task) : dataService.addTask(task));
    setDraft(null);
  };

  const updateStatus = (taskId: string, status: NonNullable<Task['status']>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !canEditTask(task)) {
      notify('View Only', 'Only the assigned user or admin can update this task.', 'orange', getTaskManagerPath());
      return;
    }
    setTasks(dataService.updateTask(taskId, {
      status,
      completed: status === 'Done',
      completedAt: status === 'Done' ? Date.now() : undefined,
      updatedAt: Date.now(),
    }));
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">

      {/* ── Page header ── */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {selectedUser && (
              <button
                onClick={closeUser}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">
                {selectedUser ? 'User Drill-Down' : TASK_MANAGER_LABEL}
              </p>
              <h1 className="font-condensed text-[28px] font-extrabold uppercase tracking-tight text-foreground">
                {selectedUser ? selectedUser : TASK_MANAGER_LABEL}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                {selectedUser
                  ? `${WORK_FILTER_LABELS[workFilter] || 'Assigned to'} ${selectedUser}`
                  : 'Per-user task widgets, task status filters, and handovers in one organized workspace.'}
              </p>
            </div>
          </div>
          {!selectedUser && (
            <button
              onClick={() => setDraft({ ...EMPTY_DRAFT, ownerId: assignmentOptions[0] || '', campaignId: campaigns[0]?.name || '' })}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gc-orange px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-white hover:bg-gc-orange/90"
            >
              <Plus size={14} /> Add Task
            </button>
          )}
        </div>
      </section>

      {/* ── OVERVIEW: summary metrics + grid ── */}
      {!selectedUser ? (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryTile label="Members" value={totals.totalUsers} color="text-gc-orange" icon={Users} active={overviewFilter === 'all'} onClick={() => setOverviewFilter('all')} />
            <SummaryTile label="All Tasks" value={totals.totalTasks} color="text-foreground" icon={ClipboardList} active={overviewFilter === 'with-tasks'} onClick={() => setOverviewFilter('with-tasks')} />
            <SummaryTile label="Done" value={totals.totalDone} color="text-emerald-600" icon={CheckCircle2} active={overviewFilter === 'done'} onClick={() => setOverviewFilter('done')} />
            <SummaryTile label="In Progress" value={totals.totalInProgress} color="text-blue-600" icon={Loader2} active={overviewFilter === 'in-progress'} onClick={() => setOverviewFilter('in-progress')} />
            <SummaryTile label="Pending" value={totals.totalPending} color="text-amber-600" icon={Clock3} active={overviewFilter === 'pending'} onClick={() => setOverviewFilter('pending')} />
            <SummaryTile label="Blocked" value={totals.totalBlocked} color="text-red-600" icon={AlertCircle} active={overviewFilter === 'blocked'} onClick={() => setOverviewFilter('blocked')} />
          </div>

          {/* Search + view controls */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="settings-input w-full pl-10"
                placeholder="Search team members..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOverviewFilter('overdue')}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold uppercase tracking-wider transition-colors',
                  overviewFilter === 'overdue' ? 'border-red-300 bg-red-50 text-red-700' : 'border-border bg-card text-muted-foreground hover:border-red-300 hover:text-red-600',
                )}
              >
                <Zap size={14} /> Overdue
              </button>
              <button
                onClick={() => setOverviewFilter('handovers')}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-extrabold uppercase tracking-wider transition-colors',
                  overviewFilter === 'handovers' ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-border bg-card text-muted-foreground hover:border-purple-300 hover:text-purple-600',
                )}
              >
                <Handshake size={14} /> Handovers
              </button>
              <div className="flex items-center rounded-xl border border-border bg-card p-1">
                <button
                  onClick={() => setOverviewView('widgets')}
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors', overviewView === 'widgets' ? 'bg-gc-orange text-white' : 'text-muted-foreground hover:text-foreground')}
                >
                  <LayoutGrid size={14} /> Widgets
                </button>
                <button
                  onClick={() => setOverviewView('list')}
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors', overviewView === 'list' ? 'bg-gc-orange text-white' : 'text-muted-foreground hover:text-foreground')}
                >
                  <List size={14} /> List
                </button>
              </div>
            </div>
          </div>

          {/* User widget grid */}
          {filteredStats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">
              No team members found.
            </div>
          ) : overviewView === 'widgets' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStats.map(stats => (
                <UserWidget key={stats.name} stats={stats} onClick={() => openUser(stats.name)} />
              ))}
            </div>
          ) : (
            <UserListView stats={filteredStats} onSelect={openUser} />
          )}
        </>
      ) : (
        /* ── DETAIL: per-user task view ── */
        <div className="space-y-5">

          {/* User stat strip */}
          {selectedStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryTile label="All Tasks" value={selectedStats.totalTasks} color="text-foreground" icon={ClipboardList} />
              <SummaryTile label="Done" value={selectedStats.doneTasks} color="text-emerald-600" icon={CheckCircle2} />
              <SummaryTile label="In Progress" value={selectedStats.inProgressTasks} color="text-blue-600" icon={Loader2} />
              <SummaryTile label="Pending" value={selectedStats.pendingTasks} color="text-amber-600" icon={Clock3} />
              <SummaryTile label="Blocked" value={selectedStats.blockedTasks} color="text-red-600" icon={AlertCircle} />
              <SummaryTile label="Handovers" value={selectedStats.totalHandovers} color="text-purple-600" icon={Handshake} />
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 w-fit">
            {([
              { id: 'tasks', label: `Tasks (${selectedUserTasks.length})` },
              { id: 'handovers', label: `Handovers (${selectedUserHandovers.length})` },
            ] as { id: 'tasks' | 'handovers'; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors',
                  detailTab === tab.id ? 'bg-gc-orange text-white' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {detailTab === 'tasks' ? (
            <TaskDetailView
              tasks={filteredDetailTasks}
              allTasks={selectedUserTasks}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              canEditTask={canEditTask}
              updateStatus={updateStatus}
              onEdit={task => setDraft(draftFromTask(task))}
              onAdd={() => setDraft({ ...EMPTY_DRAFT, ownerId: selectedUser || '', campaignId: campaigns[0]?.name || '' })}
            />
          ) : (
            <HandoverDetailView handovers={selectedUserHandovers} userName={selectedUser} />
          )}
        </div>
      )}

      {/* ── Task modal ── */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-foreground">{draft.id ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={() => setDraft(null)} className="icon-btn"><X size={16} /></button>
            </div>
            <TaskForm draft={draft} setDraft={setDraft} campaigns={campaigns} assignmentOptions={assignmentOptions} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">
                Cancel
              </button>
              <button onClick={saveTask} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-extrabold text-white hover:bg-gc-orange/90">
                <Save size={14} /> Save Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   UserWidget — the main overview card
───────────────────────────────────────────── */
function UserWidget({ stats, onClick }: { stats: DailyRoutineUserStats; onClick: () => void }) {
  const initials = stats.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const rate = stats.completionRate;
  const rateColor = rate === 100 ? 'text-emerald-600' : rate >= 70 ? 'text-gc-orange' : rate >= 40 ? 'text-amber-600' : 'text-red-600';
  const barColor = rate === 100 ? 'bg-emerald-500' : rate >= 70 ? 'bg-gc-orange' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-gc-orange/60 hover:shadow-md w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gc-orange/10 text-base font-black text-gc-orange ring-1 ring-gc-orange/20">
          {initials}
          {stats.blockedTasks > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-card">
              {stats.blockedTasks}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-foreground group-hover:text-gc-orange transition-colors">{stats.name}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {stats.totalTasks} tasks · {stats.totalHandovers} handovers
          </p>
        </div>
        <span className={cn('shrink-0 text-sm font-black tabular-nums', rateColor)}>{rate}%</span>
      </div>

      {/* Stat grid — 3 cols × 2 rows */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatCell value={stats.doneTasks}        label="Done"       bg="bg-emerald-50 dark:bg-emerald-900/20" text="text-emerald-700 dark:text-emerald-300" border="border-emerald-200 dark:border-emerald-800" />
        <StatCell value={stats.inProgressTasks}  label="Active"     bg="bg-blue-50 dark:bg-blue-900/20"       text="text-blue-700 dark:text-blue-300"       border="border-blue-200 dark:border-blue-800"     />
        <StatCell value={stats.pendingTasks}      label="Pending"    bg="bg-amber-50 dark:bg-amber-900/20"     text="text-amber-700 dark:text-amber-300"     border="border-amber-200 dark:border-amber-800"   />
        <StatCell value={stats.blockedTasks}      label="Blocked"    bg={stats.blockedTasks > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'}       text={stats.blockedTasks > 0 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}         border={stats.blockedTasks > 0 ? 'border-red-200 dark:border-red-800' : 'border-border'}      />
        <StatCell value={stats.totalHandovers}    label="Handovers"  bg="bg-purple-50 dark:bg-purple-900/20"   text="text-purple-700 dark:text-purple-300"   border="border-purple-200 dark:border-purple-800" />
        <StatCell value={stats.overdueTasks}      label="Overdue"    bg={stats.overdueTasks > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'}        text={stats.overdueTasks > 0 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}          border={stats.overdueTasks > 0 ? 'border-red-200 dark:border-red-800' : 'border-border'}       />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
          <span className="text-muted-foreground">Completion</span>
          <span className={rateColor}>{rate}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px]">
        <span className={stats.overdueTasks > 0 ? 'font-extrabold text-red-600' : 'font-semibold text-muted-foreground'}>
          {stats.overdueTasks > 0 ? `⚠ ${stats.overdueTasks} overdue` : stats.totalTasks === 0 ? 'No tasks yet' : 'On track'}
        </span>
        <span className="flex items-center gap-1 font-extrabold text-gc-orange group-hover:gap-2 transition-all">
          View details <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

function StatCell({ value, label, bg, text, border }: { value: number; label: string; bg: string; text: string; border: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-lg border p-2', bg, border)}>
      <span className={cn('text-xl font-black tabular-nums leading-none', text)}>{value}</span>
      <span className={cn('mt-1 text-[9px] font-extrabold uppercase tracking-wide', text)}>{label}</span>
    </div>
  );
}

function UserListView({ stats, onSelect }: { stats: DailyRoutineUserStats[]; onSelect: (name: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-[1.5fr_0.65fr_0.65fr_0.75fr_0.75fr_0.75fr_0.8fr_0.8fr_0.75fr] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground max-lg:hidden">
        <span>Member</span>
        <span className="text-center">Tasks</span>
        <span className="text-center">Done</span>
        <span className="text-center">Active</span>
        <span className="text-center">Pending</span>
        <span className="text-center">Blocked</span>
        <span className="text-center">Overdue</span>
        <span className="text-center">Handovers</span>
        <span className="text-right">Rate</span>
      </div>
      <div className="divide-y divide-border">
        {stats.map((row) => {
          const initials = row.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
          return (
            <button
              key={row.name}
              onClick={() => onSelect(row.name)}
              className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35 lg:grid-cols-[1.5fr_0.65fr_0.65fr_0.75fr_0.75fr_0.75fr_0.8fr_0.8fr_0.75fr] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gc-orange/10 text-xs font-black text-gc-orange ring-1 ring-gc-orange/20">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{row.name}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground lg:hidden">
                    {row.totalTasks} tasks · {row.totalHandovers} handovers · {row.completionRate}% done
                  </p>
                </div>
              </div>
              <ListMetric value={row.totalTasks} />
              <ListMetric value={row.doneTasks} tone="text-emerald-600" />
              <ListMetric value={row.inProgressTasks} tone="text-blue-600" />
              <ListMetric value={row.pendingTasks} tone="text-amber-600" />
              <ListMetric value={row.blockedTasks} tone={row.blockedTasks > 0 ? 'text-red-600' : 'text-muted-foreground'} />
              <ListMetric value={row.overdueTasks} tone={row.overdueTasks > 0 ? 'text-red-600' : 'text-muted-foreground'} />
              <ListMetric value={row.totalHandovers} tone="text-purple-600" />
              <span className="hidden text-right text-sm font-black tabular-nums text-foreground lg:block">{row.completionRate}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListMetric({ value, tone = 'text-foreground' }: { value: number; tone?: string }) {
  return <span className={cn('hidden text-center text-sm font-black tabular-nums lg:block', tone)}>{value}</span>;
}

/* ─────────────────────────────────────────────
   Task detail view (inside user drill-down)
───────────────────────────────────────────── */
function TaskDetailView({
  tasks,
  allTasks,
  statusFilter,
  setStatusFilter,
  canEditTask,
  updateStatus,
  onEdit,
  onAdd,
}: {
  tasks: Task[];
  allTasks: Task[];
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  canEditTask: (t: Task) => boolean;
  updateStatus: (id: string, status: NonNullable<Task['status']>) => void;
  onEdit: (t: Task) => void;
  onAdd: () => void;
}) {
  const countByStatus = useMemo(() => {
    const m: Record<string, number> = { all: allTasks.length };
    STATUS_ORDER.forEach(s => { m[s] = allTasks.filter(t => getOperationalTaskStatus(t) === s).length; });
    return m;
  }, [allTasks]);

  return (
    <div className="space-y-4">
      {/* Status filter pills + add button */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...STATUS_ORDER] as const).map(s => {
          const meta = s !== 'all' ? STATUS_META[s] : null;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide transition-colors',
                active
                  ? s === 'all' ? 'border-gc-orange bg-gc-orange text-white' : `${meta!.border} ${meta!.bg} ${meta!.text}`
                  : 'border-border bg-card text-muted-foreground hover:border-gc-orange/40 hover:text-foreground',
              )}
            >
              {s === 'all' ? 'All' : s}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', active && s !== 'all' ? `${meta!.bg} ${meta!.text}` : 'bg-muted text-muted-foreground')}>
                {countByStatus[s] ?? 0}
              </span>
            </button>
          );
        })}
        <button
          onClick={onAdd}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gc-orange px-3 py-1.5 text-xs font-extrabold text-white hover:bg-gc-orange/90"
        >
          <Plus size={13} /> New Task
        </button>
      </div>

      {/* Task cards */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center text-sm text-muted-foreground">
          No tasks match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const status = getOperationalTaskStatus(task);
            const meta = STATUS_META[status];
            const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
            const isOverdue = !task.completed && task.dueDate && task.dueDate < Date.now();
            const canEdit = canEditTask(task);
            return (
              <div
                key={task.id}
                className={cn(
                  'group rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
                  status === 'Blocked' ? 'border-red-200 dark:border-red-900/40' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">

                  {/* Status dot + title block */}
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-extrabold text-foreground', task.completed && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>
                      {(task.description || task.nextStep) && (
                        <p className="mt-1 text-xs font-medium text-muted-foreground line-clamp-2">
                          {task.nextStep || task.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {task.campaignId && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {task.campaignId}
                          </span>
                        )}
                        {task.department && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {task.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right-side controls */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
                    {/* Priority + status row */}
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', pMeta.bg, pMeta.text, pMeta.border)}>
                        {task.priority}
                      </span>
                      <select
                        className={cn('h-7 cursor-pointer rounded-full border px-2.5 text-[10px] font-extrabold uppercase tracking-wide outline-none transition-colors', meta.bg, meta.text, meta.border)}
                        value={status}
                        disabled={!canEdit}
                        onChange={e => updateStatus(task.id, e.target.value as NonNullable<Task['status']>)}
                      >
                        {['Pending', 'In Progress', 'Blocked', 'Done'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Due date */}
                    <div className={cn('flex items-center gap-1 text-[11px] font-semibold', isOverdue ? 'text-red-600' : 'text-muted-foreground')}>
                      <Clock3 size={11} />
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'No due date'}
                      {isOverdue && <span className="ml-0.5 font-extrabold text-red-600">· Overdue</span>}
                    </div>

                    {/* Edit button */}
                    {canEdit && (
                      <button
                        onClick={() => onEdit(task)}
                        className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:border-gc-orange hover:text-gc-orange transition-colors"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Handover detail view
───────────────────────────────────────────── */
function HandoverDetailView({ handovers, userName }: { handovers: Handover[]; userName: string | null }) {
  if (handovers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center text-sm text-muted-foreground">
        No handovers involving {userName}.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {handovers.map(h => {
        const isFrom = (h.assignFrom || []).some(n => n.toLowerCase() === userName?.toLowerCase()) || h.outgoingLead?.toLowerCase() === userName?.toLowerCase();
        return (
          <div key={h.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isFrom ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600')}>
                  <Handshake size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-foreground">{h.team}</span>
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                      h.status === 'Reviewed' ? 'bg-emerald-50 text-emerald-700' :
                      h.status === 'Acknowledged' ? 'bg-purple-50 text-purple-700' :
                      'bg-amber-50 text-amber-700',
                    )}>{h.status}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', isFrom ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700')}>
                      {isFrom ? 'Outgoing' : 'Incoming'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {h.fromShift} → {h.toShift} · {h.region} · {h.handoffDate}
                  </p>
                  {(h.assignFrom?.length || h.assignTo?.length) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {h.assignFrom?.length ? <span className="rounded-full bg-orange-50 px-2 py-0.5 font-bold text-orange-700">From: {h.assignFrom.join(', ')}</span> : null}
                      {h.assignTo?.length ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">To: {h.assignTo.join(', ')}</span> : null}
                    </div>
                  )}
                  {h.notes && <p className="mt-2 text-xs text-muted-foreground">{h.notes}</p>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Task form (modal)
───────────────────────────────────────────── */
function TaskForm({ draft, setDraft, campaigns, assignmentOptions }: {
  draft: TaskDraft;
  setDraft: (d: TaskDraft) => void;
  campaigns: Campaign[];
  assignmentOptions: string[];
}) {
  const PMO_LANES = ['PMO', 'Community', 'Coverage', 'QA', 'Reporting', 'Finance', 'Operations'];
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <input
        className="settings-input md:col-span-2"
        placeholder="Task title *"
        value={draft.title}
        onChange={e => setDraft({ ...draft, title: e.target.value })}
      />
      <select className="settings-input" value={draft.ownerId} onChange={e => setDraft({ ...draft, ownerId: e.target.value })}>
        <option value="">Assigned to…</option>
        {[draft.ownerId, ...assignmentOptions].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <select className="settings-input" value={draft.campaignId} onChange={e => setDraft({ ...draft, campaignId: e.target.value })}>
        <option value="">No campaign</option>
        {campaigns.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
      <select className="settings-input" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })}>
        {[draft.department, ...PMO_LANES].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <input className="settings-input" type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} />
      <select className="settings-input" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Task['priority'] })}>
        {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select className="settings-input" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as NonNullable<Task['status']> })}>
        {['Pending', 'In Progress', 'Blocked', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <textarea
        className="settings-input min-h-[80px] resize-none md:col-span-2"
        placeholder="Notes / next step"
        value={draft.nextStep}
        onChange={e => setDraft({ ...draft, nextStep: e.target.value })}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Summary tile (overview bar)
───────────────────────────────────────────── */
function SummaryTile({
  label,
  value,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors',
        active ? 'border-gc-orange bg-gc-orange/5 ring-1 ring-gc-orange/15' : 'border-border',
        onClick && 'hover:border-gc-orange/60 hover:bg-gc-orange/5',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', color)} />
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn('text-xl font-black tabular-nums', color)}>{value}</p>
      </div>
    </Comp>
  );
}
