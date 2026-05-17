import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Clock3, Edit3, Handshake, Plus, Save, Search, Users, X } from 'lucide-react';
import { useAuth } from '../App';
import { dataService } from '../services/dataService';
import { canEditTaskRecord } from '../lib/workspace';
import { getDefaultPlatformUserNames, loadPlatformUserNames, sortUniqueUserNames } from '../lib/platformUsers';
import { getOperationalTaskStatus } from '../lib/opsPageInsights';
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

type UserStats = {
  name: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  handoversAsTo: number;
  handoversAsFrom: number;
  totalHandovers: number;
  completionRate: number;
};

const STATUS_STYLES: Record<string, string> = {
  Done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  'In Progress': 'border-blue-500/20 bg-blue-500/10 text-blue-600',
  Pending: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  Blocked: 'border-red-500/20 bg-red-500/10 text-red-600',
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
  const names = new Set<string>();
  platformUsers.forEach(n => names.add(n));
  tasks.forEach(t => { if (t.ownerId?.trim()) names.add(t.ownerId.trim()); });
  handovers.forEach(h => {
    h.assignFrom?.forEach(n => names.add(n));
    h.assignTo?.forEach(n => names.add(n));
    if (h.outgoingLead?.trim()) names.add(h.outgoingLead.trim());
    if (h.incomingLead?.trim()) names.add(h.incomingLead.trim());
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function getUserStats(name: string, tasks: Task[], handovers: Handover[]): UserStats {
  const userTasks = tasks.filter(t => t.ownerId?.toLowerCase() === name.toLowerCase());
  const done = userTasks.filter(t => t.completed).length;
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

export default function DailyRoutines() {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(dataService.getTasks());
  const [handovers] = useState<Handover[]>(dataService.getHandovers());
  const [campaigns] = useState<Campaign[]>(dataService.getCampaigns());
  const [platformUsers, setPlatformUsers] = useState<string[]>(getDefaultPlatformUserNames());
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [detailTab, setDetailTab] = useState<'tasks' | 'handovers'>('tasks');

  useEffect(() => {
    let alive = true;
    loadPlatformUserNames().then(users => {
      if (alive) setPlatformUsers(users);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const allUserNames = useMemo(() => collectUserNames(tasks, handovers, platformUsers), [tasks, handovers, platformUsers]);

  const filteredUserNames = useMemo(() => {
    if (!query.trim()) return allUserNames;
    const q = query.toLowerCase();
    return allUserNames.filter(n => n.toLowerCase().includes(q));
  }, [allUserNames, query]);

  const allStats = useMemo(() => {
    const stats = new Map<string, UserStats>();
    allUserNames.forEach(name => stats.set(name.toLowerCase(), getUserStats(name, tasks, handovers)));
    return stats;
  }, [allUserNames, tasks, handovers]);

  const filteredStats = useMemo(() => {
    return filteredUserNames.map(n => allStats.get(n.toLowerCase())!).sort((a, b) => b.totalTasks - a.totalTasks);
  }, [filteredUserNames, allStats]);

  const selectedStats = selectedUser ? allStats.get(selectedUser.toLowerCase()) : null;

  const selectedUserTasks = useMemo(() => {
    if (!selectedUser) return [];
    return tasks
      .filter(t => t.ownerId?.toLowerCase() === selectedUser.toLowerCase())
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      });
  }, [selectedUser, tasks]);

  const selectedUserHandovers = useMemo(() => {
    if (!selectedUser) return [];
    return handovers.filter(h =>
      (h.assignFrom || []).some(n => n.toLowerCase() === selectedUser.toLowerCase()) ||
      (h.assignTo || []).some(n => n.toLowerCase() === selectedUser.toLowerCase()) ||
      h.outgoingLead?.toLowerCase() === selectedUser.toLowerCase() ||
      h.incomingLead?.toLowerCase() === selectedUser.toLowerCase()
    );
  }, [selectedUser, handovers]);

  const assignmentOptions = useMemo(
    () => sortUniqueUserNames([...platformUsers, user?.displayName]),
    [platformUsers, user?.displayName],
  );

  const canEditTask = (task: Task) => canEditTaskRecord(role, user?.displayName, task);

  const totals = useMemo(() => {
    let totalUsers = 0, totalTasks = 0, totalDone = 0, totalBlocked = 0;
    filteredStats.forEach(s => {
      totalUsers++;
      totalTasks += s.totalTasks;
      totalDone += s.doneTasks;
      totalBlocked += s.blockedTasks;
    });
    return { totalUsers, totalTasks, totalDone, totalBlocked };
  }, [filteredStats]);

  const saveTask = () => {
    if (!draft?.title.trim()) return;
    const now = Date.now();
    const existing = draft.id ? tasks.find((task) => task.id === draft.id) : undefined;
    if (existing && !canEditTask(existing)) {
      notify('View Only', 'Only the assigned user or Master can edit this routine task.', 'orange', '/daily-routines');
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
      notify('View Only', 'Only the assigned user or Master can update this task.', 'orange', '/daily-routines');
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
    <div className="mx-auto max-w-[1360px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Team Workspace</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {selectedUser ? (
                <span className="inline-flex items-center gap-3">
                  <button onClick={() => { setSelectedUser(null); setDetailTab('tasks'); }} className="inline-flex items-center gap-1.5 text-sm font-bold text-gc-orange hover:underline">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <span className="border-l border-border pl-3">{selectedUser}</span>
                </span>
              ) : (
                'Team Tasks Dashboard'
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedUser
                ? `Tasks and handovers assigned to ${selectedUser}`
                : 'User widgets with task counts, handovers, and drill-down details.'}
            </p>
          </div>
          {!selectedUser && (
            <button onClick={() => setDraft({ ...EMPTY_DRAFT, ownerId: assignmentOptions[0] || '', campaignId: campaigns[0]?.name || '' })} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90">
              <Plus size={15} /> Add task
            </button>
          )}
        </div>
      </section>

      {!selectedUser ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Metric title="Team Members" value={totals.totalUsers} icon={Users} />
            <Metric title="Total Tasks" value={totals.totalTasks} icon={ClipboardList} />
            <Metric title="Completed" value={totals.totalDone} icon={CheckCircle2} tone="green" />
            <Metric title="Blocked" value={totals.totalBlocked} icon={Clock3} tone="red" />
            <Metric title="Handovers" value={handovers.length} icon={Handshake} tone="purple" />
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="settings-input w-full pl-9" placeholder="Search team members..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </section>

          {filteredStats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No team members found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStats.map((stats) => (
                <UserWidget
                  key={stats.name}
                  stats={stats}
                  onClick={() => setSelectedUser(stats.name)}
                />
              ))}
            </div>
          )}

          {draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-foreground">{draft.id ? 'Edit daily task' : 'Add daily task'}</h3>
                  <button onClick={() => setDraft(null)} className="icon-btn"><X size={16} /></button>
                </div>
                <TaskForm draft={draft} setDraft={setDraft} campaigns={campaigns} assignmentOptions={assignmentOptions} />
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">Cancel</button>
                  <button onClick={saveTask} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90"><Save size={15} /> Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {selectedStats && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <Metric title="Total Tasks" value={selectedStats.totalTasks} icon={ClipboardList} />
              <Metric title="Completed" value={selectedStats.doneTasks} icon={CheckCircle2} tone="green" />
              <Metric title="In Progress" value={selectedStats.inProgressTasks} icon={Clock3} tone="blue" />
              <Metric title="Pending" value={selectedStats.pendingTasks} icon={ClipboardList} tone="amber" />
              <Metric title="Blocked" value={selectedStats.blockedTasks} icon={Clock3} tone="red" />
              <Metric title="Handovers" value={selectedStats.totalHandovers} icon={Handshake} tone="purple" />
            </div>
          )}

          <div className="flex gap-2 border-b border-border">
            <button onClick={() => setDetailTab('tasks')} className={cn('px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors', detailTab === 'tasks' ? 'border-gc-orange text-gc-orange' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              Tasks ({selectedUserTasks.length})
            </button>
            <button onClick={() => setDetailTab('handovers')} className={cn('px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors', detailTab === 'handovers' ? 'border-gc-orange text-gc-orange' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              Handovers ({selectedUserHandovers.length})
            </button>
          </div>

          {detailTab === 'tasks' ? (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="hidden grid-cols-[1fr_10rem_8rem_8rem_10rem_7rem] items-center gap-x-4 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Task</span>
                <span>Campaign</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Due Date</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border">
                {selectedUserTasks.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No tasks assigned to this user.</div>
                ) : (
                  selectedUserTasks.map(task => {
                    const status = getOperationalTaskStatus(task);
                    const canEdit = canEditTask(task);
                    return (
                      <div key={task.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1fr_10rem_8rem_8rem_10rem_7rem] items-center md:gap-4">
                        <div className="min-w-0">
                          <p className={cn('truncate text-sm font-semibold text-foreground', task.completed && 'line-through text-muted-foreground')}>{task.title}</p>
                          {task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground">{task.campaignId || '-'}</div>
                        <div>
                          <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold', task.priority === 'Critical' ? 'border-red-200 bg-red-50 text-red-700' : task.priority === 'High' ? 'border-orange-200 bg-orange-50 text-orange-700' : task.priority === 'Medium' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700')}>{task.priority}</span>
                        </div>
                        <div>
                          <select className={cn('h-7 rounded border px-1.5 text-[10px] font-bold uppercase', STATUS_STYLES[status])} value={status} disabled={!canEdit} onChange={(e) => updateStatus(task.id, e.target.value as NonNullable<Task['status']>)}>
                            {['Pending', 'In Progress', 'Blocked', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className={cn('text-xs', !task.completed && task.dueDate && task.dueDate < Date.now() ? 'font-semibold text-red-600' : 'text-foreground')}>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                        <div className="flex items-center gap-1">
                          {canEdit && <button onClick={() => setDraft(draftFromTask(task))} className="icon-btn" title="Edit"><Edit3 size={13} /></button>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedUserHandovers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No handovers involving this user.</div>
              ) : (
                selectedUserHandovers.map(handover => (
                  <div key={handover.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{handover.team}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', handover.status === 'Reviewed' ? 'bg-green-50 text-green-700' : handover.status === 'Acknowledged' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700')}>{handover.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {handover.fromShift} → {handover.toShift} · {handover.region} · {handover.handoffDate}
                        </p>
                        {(handover.assignFrom || handover.assignTo) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {handover.assignFrom && handover.assignFrom.length > 0 && (
                              <span className="rounded bg-red-50 px-2 py-0.5 font-bold text-red-700">From: {handover.assignFrom.join(', ')}</span>
                            )}
                            {handover.assignTo && handover.assignTo.length > 0 && (
                              <span className="rounded bg-green-50 px-2 py-0.5 font-bold text-green-700">To: {handover.assignTo.join(', ')}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(handover.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {handover.notes && <p className="mt-2 text-xs text-muted-foreground">{handover.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-foreground">{draft.id ? 'Edit daily task' : 'Add daily task'}</h3>
                  <button onClick={() => setDraft(null)} className="icon-btn"><X size={16} /></button>
                </div>
                <TaskForm draft={draft} setDraft={setDraft} campaigns={campaigns} assignmentOptions={assignmentOptions} />
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">Cancel</button>
                  <button onClick={saveTask} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90"><Save size={15} /> Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserWidget({ stats, onClick }: { stats: UserStats; onClick: () => void }) {
  const initials = stats.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <button onClick={onClick} className="group rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gc-orange hover:shadow-md w-full">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gc-orange/10 text-sm font-black text-gc-orange">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-foreground">{stats.name}</p>
          <p className="text-xs text-muted-foreground">{stats.totalTasks} tasks · {stats.totalHandovers} handovers</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
          <p className="text-lg font-black text-emerald-600">{stats.doneTasks}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Done</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
          <p className="text-lg font-black text-blue-600">{stats.inProgressTasks}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-600">In Prog</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
          <p className="text-lg font-black text-red-600">{stats.blockedTasks}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Blocked</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-muted-foreground">Progress</span>
          <span className={stats.completionRate >= 80 ? 'text-emerald-600' : stats.completionRate >= 50 ? 'text-gc-orange' : 'text-muted-foreground'}>{stats.completionRate}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', stats.completionRate === 100 ? 'bg-emerald-500' : stats.completionRate >= 50 ? 'bg-gc-orange' : 'bg-amber-500')} style={{ width: `${stats.completionRate}%` }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span>{stats.overdueTasks > 0 ? <span className="font-bold text-red-600">{stats.overdueTasks} overdue</span> : 'On track'}</span>
        <span className="font-semibold text-gc-orange group-hover:underline">View →</span>
      </div>
    </button>
  );
}

function TaskForm({ draft, setDraft, campaigns, assignmentOptions }: { draft: TaskDraft; setDraft: (draft: TaskDraft) => void; campaigns: Campaign[]; assignmentOptions: string[] }) {
  const PMO_LANES = ['PMO', 'Community', 'Coverage', 'QA', 'Reporting', 'Finance', 'Operations'];
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <input className="settings-input md:col-span-2" placeholder="Task title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      <select className="settings-input" value={draft.ownerId} onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}>
        <option value="">Assigned to...</option>
        {[draft.ownerId, ...assignmentOptions].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).map((owner) => <option key={owner} value={owner}>{owner}</option>)}
      </select>
      <select className="settings-input" value={draft.campaignId} onChange={(event) => setDraft({ ...draft, campaignId: event.target.value })}>
        <option value="">No campaign</option>
        {campaigns.map((campaign) => <option key={campaign.id} value={campaign.name}>{campaign.name}</option>)}
      </select>
      <select className="settings-input" value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })}>
        {[draft.department, ...PMO_LANES].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).map((lane) => <option key={lane} value={lane}>{lane}</option>)}
      </select>
      <input className="settings-input" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
      <select className="settings-input" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Task['priority'] })}>
        {['Low', 'Medium', 'High', 'Critical'].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className="settings-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as NonNullable<Task['status']> })}>
        {['Pending', 'In Progress', 'Blocked', 'Done'].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <textarea className="settings-input min-h-20 resize-none md:col-span-2" placeholder="Next step / result" value={draft.nextStep} onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })} />
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone = 'orange' }: { title: string; value: number | string; icon: React.ElementType; tone?: 'orange' | 'green' | 'red' | 'purple' | 'blue' | 'amber' }) {
  const tones: Record<string, string> = {
    orange: 'bg-gc-orange/10 text-gc-orange border-gc-orange/20',
    green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{title}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', tones[tone])}><Icon size={15} /></div>
      </div>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}
