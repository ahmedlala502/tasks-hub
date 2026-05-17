import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Edit3, LayoutGrid, List, Plus, Save, Search, X } from 'lucide-react';
import { useAuth } from '../App';
import { dataService } from '../services/dataService';
import { canEditTaskRecord } from '../lib/workspace';
import { getDefaultPlatformUserNames, loadPlatformUserNames, sortUniqueUserNames } from '../lib/platformUsers';
import { buildDailyFocus, getOperationalTaskStatus } from '../lib/opsPageInsights';
import { cn } from '../lib/utils';
import { notify } from '../services/notificationService';
import type { Campaign, Task } from '../types';

type ViewMode = 'cover' | 'list';
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

const PMO_CADENCE = [
  { id: 'standup', title: 'AM standup', owner: 'PMO', detail: 'Confirm owners, blockers, due-today work, and campaign risks.' },
  { id: 'midday', title: 'Midday follow-up', owner: 'PMO', detail: 'Check campaign lanes, unblock approvals, and update task statuses.' },
  { id: 'qa', title: 'Quality gate', owner: 'QA', detail: 'Review critical outputs, evidence, and coverage readiness.' },
  { id: 'handover', title: 'Shift handover', owner: 'Operations', detail: 'Move context into the handover page before the shift changes.' },
];

const PMO_LANES = ['PMO', 'Community', 'Coverage', 'QA', 'Reporting', 'Finance', 'Operations'];
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

export default function DailyRoutines() {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(dataService.getTasks());
  const [campaigns] = useState<Campaign[]>(dataService.getCampaigns());
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cover');
  const [routineDone, setRoutineDone] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [platformUsers, setPlatformUsers] = useState<string[]>(getDefaultPlatformUserNames());
  const focus = useMemo(() => buildDailyFocus(tasks), [tasks]);
  const assignmentOptions = useMemo(
    () => sortUniqueUserNames([...platformUsers, user?.displayName]),
    [platformUsers, user?.displayName],
  );
  const canEditTask = (task: Task) => canEditTaskRecord(role, user?.displayName, task);

  useEffect(() => {
    let alive = true;
    loadPlatformUserNames().then(users => {
      if (alive) setPlatformUsers(users);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const haystack = `${task.title} ${task.campaignId} ${task.ownerId} ${task.department} ${task.nextStep}`.toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }), [query, tasks]);
  const routinePercent = Math.round((Object.values(routineDone).filter(Boolean).length / PMO_CADENCE.length) * 100);

  const openCreate = (department = 'PMO') => {
    setDraft({
      ...EMPTY_DRAFT,
      department,
      ownerId: assignmentOptions[0] || '',
      campaignId: campaigns[0]?.name || '',
    });
  };

  const saveTask = () => {
    if (!draft?.title.trim()) return;
    const now = Date.now();
    const existing = draft.id ? tasks.find((task) => task.id === draft.id) : undefined;
    if (existing && !canEditTask(existing)) {
      notify('View Only', 'Only the assigned user or Master can edit this routine task.', 'orange', '/tasks-daily-routines');
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

  const updateStatus = (task: Task, status: NonNullable<Task['status']>) => {
    if (!canEditTask(task)) {
      notify('View Only', 'Only the assigned user or Master can update this routine task.', 'orange', '/tasks-daily-routines');
      return;
    }
    setTasks(dataService.updateTask(task.id, {
      status,
      completed: status === 'Done',
      completedAt: status === 'Done' ? Date.now() : undefined,
      updatedAt: Date.now(),
    }));
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Tasks & Daily Routine</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">PMO Daily Operating Board</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create, assign, update, and run daily PMO work in cover or list layout.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setViewMode('cover')} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold', viewMode === 'cover' ? 'bg-gc-orange text-white' : 'border border-border bg-background text-foreground hover:bg-accent')}>
              <LayoutGrid size={15} /> Cover
            </button>
            <button onClick={() => setViewMode('list')} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold', viewMode === 'list' ? 'bg-gc-orange text-white' : 'border border-border bg-background text-foreground hover:bg-accent')}>
              <List size={15} /> List
            </button>
            <button onClick={() => openCreate()} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90">
              <Plus size={15} /> Add task
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="Routine Done" value={`${routinePercent}%`} />
        <Metric title="Blocked" value={focus.blocked} tone="red" />
        <Metric title="Overdue" value={focus.overdue} tone="red" />
        <Metric title="Due Today" value={focus.dueToday} tone="purple" />
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="settings-input pl-9" placeholder="Search task, campaign, owner, lane..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground">{visibleTasks.length} visible tasks</div>
        </div>
      </section>

      {viewMode === 'cover' ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-extrabold text-foreground">PMO Cadence</h3>
            <div className="mt-4 space-y-3">
              {PMO_CADENCE.map((routine) => (
                <button key={routine.id} onClick={() => setRoutineDone((current) => ({ ...current, [routine.id]: !current[routine.id] }))} className={cn('w-full rounded-lg border p-4 text-left transition-colors', routineDone[routine.id] ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-border bg-background hover:bg-accent/40')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-1 flex h-5 w-5 items-center justify-center rounded border', routineDone[routine.id] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border')}>
                      {routineDone[routine.id] && <CheckCircle2 size={14} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{routine.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{routine.owner} - {routine.detail}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {focus.recommendations.map((item) => <div key={item} className="rounded-lg border border-gc-orange/20 bg-gc-orange/10 px-3 py-2 text-xs font-semibold text-gc-orange">{item}</div>)}
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="grid gap-4 xl:grid-cols-3">
              <TaskLane title="Focus Queue" tasks={focus.queue} canEditTask={canEditTask} onEdit={(task) => setDraft(draftFromTask(task))} onStatus={updateStatus} onCreate={() => openCreate('PMO')} />
              {PMO_LANES.slice(0, 2).map((lane) => <TaskLane key={lane} title={lane} tasks={visibleTasks.filter((task) => (task.department || task.category || 'Operations') === lane).slice(0, 10)} canEditTask={canEditTask} onEdit={(task) => setDraft(draftFromTask(task))} onStatus={updateStatus} onCreate={() => openCreate(lane)} />)}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              {PMO_LANES.slice(2).map((lane) => <TaskLane key={lane} title={lane} tasks={visibleTasks.filter((task) => (task.department || task.category || 'Operations') === lane).slice(0, 8)} canEditTask={canEditTask} onEdit={(task) => setDraft(draftFromTask(task))} onStatus={updateStatus} onCreate={() => openCreate(lane)} compact />)}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Task', 'Assigned To', 'Campaign', 'Lane', 'Priority', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{head}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3 text-sm font-bold text-foreground">{task.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{task.ownerId || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{task.campaignId || 'No campaign'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{task.department || task.category || 'Operations'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{task.priority}</td>
                    <td className="px-4 py-3">
                      <select className="settings-input h-8 text-[11px]" value={getOperationalTaskStatus(task)} disabled={!canEditTask(task)} onChange={(event) => updateStatus(task, event.target.value as NonNullable<Task['status']>)}>
                        {['Pending', 'In Progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {canEditTask(task) && <button onClick={() => setDraft(draftFromTask(task))} className="icon-btn" title="Edit task"><Edit3 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
  );
}

function TaskLane({ title, tasks, canEditTask, onEdit, onStatus, onCreate, compact = false }: { title: string; tasks: Task[]; canEditTask: (task: Task) => boolean; onEdit: (task: Task) => void; onStatus: (task: Task, status: NonNullable<Task['status']>) => void; onCreate: () => void; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{title}</p>
        <button onClick={onCreate} className="icon-btn" title="Add task"><Plus size={14} /></button>
      </div>
      <div className="mt-3 space-y-3">
        {tasks.length ? tasks.map((task) => (
          <div key={task.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{task.title}</p>
                {!compact && <p className="mt-1 text-[11px] text-muted-foreground">{task.campaignId || 'No campaign'} - {task.ownerId || 'Unassigned'}</p>}
              </div>
              {canEditTask(task) && <button onClick={() => onEdit(task)} className="icon-btn" title="Edit task"><Edit3 size={14} /></button>}
            </div>
            <select className="settings-input mt-2 h-8 text-[11px]" value={getOperationalTaskStatus(task)} disabled={!canEditTask(task)} onChange={(event) => onStatus(task, event.target.value as NonNullable<Task['status']>)}>
              {['Pending', 'In Progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        )) : <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Empty</div>}
      </div>
    </div>
  );
}

function TaskForm({ draft, setDraft, campaigns, assignmentOptions }: { draft: TaskDraft; setDraft: (draft: TaskDraft) => void; campaigns: Campaign[]; assignmentOptions: string[] }) {
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

function Metric({ title, value, tone = 'orange' }: { title: string; value: number | string; tone?: 'orange' | 'red' | 'purple' }) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'purple' ? 'text-gc-purple' : 'text-gc-orange';
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{title}</p>
        <ClipboardList size={17} className={toneClass} />
      </div>
      <p className={cn('mt-4 text-3xl font-black', toneClass)}>{value}</p>
    </div>
  );
}
