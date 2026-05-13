/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpCircle,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Flag,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { format, isPast, isValid } from 'date-fns';
import { useAuth } from '../App';
import { filterCampaignsByRole, filterOwnerOptionsByRole, filterTasksByRole } from '../lib/workspace';
import { cn } from '../utils';
import { dataService, TEAM_MEMBERS } from '../services/dataService';
import { notify } from '../services/notificationService';
import { Task } from '../types';
import { completeDailyTask, getDueReminderCandidates } from '../lib/dailyOperatingTasks';

const PRIORITIES: Task['priority'][] = ['Critical', 'High', 'Medium', 'Low'];
const ONE_DAY = 86400000;
const REMINDER_STORAGE_KEY = 'GC_DAILY_TASK_REMINDERS_SENT';

const fallbackDueDate = () => Date.now() + ONE_DAY;

const toValidDate = (value: unknown, fallback = fallbackDueDate()) => {
  const timestamp = typeof value === 'number' ? value : Number(value);
  const date = new Date(timestamp);
  return isValid(date) ? date : new Date(fallback);
};

const toValidTimestamp = (value: unknown, fallback = fallbackDueDate()) =>
  toValidDate(value, fallback).getTime();

const formatDueDate = (value: unknown, dateFormat: string) =>
  format(toValidDate(value), dateFormat);

const parseDateInput = (value: string, fallback: unknown) => {
  if (!value) return toValidTimestamp(fallback);
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : toValidTimestamp(fallback);
};

const isTaskOverdue = (task: Task) =>
  !task.completed && isPast(toValidDate(task.dueDate));

const loadNotifiedReminderKeys = (): Set<string> => {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveNotifiedReminderKeys = (keys: Set<string>) => {
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([...keys].slice(-300)));
  } catch {}
};

const emptyDraft = (): Partial<Task> => ({
  title: '',
  description: '',
  ownerId: '',
  campaignId: 'Generic Ops',
  priority: 'Medium',
  dueDate: fallbackDueDate(),
  completed: false,
});

const PRIORITY_CONFIG: Record<
  Task['priority'],
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bg: string;
    border: string;
    badge: string;
    headerBg: string;
    dot: string;
  }
> = {
  Critical: {
    label: 'Critical',
    icon: Flame,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-900/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    headerBg: 'bg-red-50/70 dark:bg-red-900/20 border-b-2 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  High: {
    label: 'High',
    icon: AlertCircle,
    color: 'text-gc-orange',
    bg: 'bg-orange-50 dark:bg-orange-900/10',
    border: 'border-orange-200 dark:border-orange-900/30',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    headerBg: 'bg-orange-50/70 dark:bg-orange-900/20 border-b-2 border-orange-200 dark:border-orange-800',
    dot: 'bg-gc-orange',
  },
  Medium: {
    label: 'Medium',
    icon: ArrowUpCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-900/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    headerBg: 'bg-amber-50/70 dark:bg-amber-900/20 border-b-2 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  Low: {
    label: 'Low',
    icon: Circle,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/10',
    border: 'border-green-200 dark:border-green-900/30',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    headerBg: 'bg-green-50/70 dark:bg-green-900/20 border-b-2 border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
};

export default function PriorityBoard() {
  const { role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(
    filterTasksByRole(role, dataService.getTasks())
  );
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForPriority, setCreateForPriority] = useState<Task['priority']>('Medium');
  const [draft, setDraft] = useState<Partial<Task>>(emptyDraft());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [supabaseUsers, setSupabaseUsers] = useState<string[]>([]);
  const [lastDailySync, setLastDailySync] = useState('');

  const syncDailyTasks = useCallback((mode: 'auto' | 'manual' = 'auto') => {
    const result = dataService.ensureDailyOperatingTasks();
    const scoped = filterTasksByRole(role, result.tasks);
    setTasks(scoped);
    setLastDailySync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    if (result.createdCount > 0) {
      notify(
        'Daily Operating Sheet Ready',
        `${result.createdCount} recurring tasks created for today`,
        'purple',
        '/priority-board',
      );
    } else if (mode === 'manual') {
      notify('Daily Tasks Already Current', 'No duplicate tasks were added for today', 'green', '/priority-board');
    }
  }, [role]);

  useEffect(() => {
    syncDailyTasks('auto');
  }, [syncDailyTasks]);

  useEffect(() => {
    let mounted = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers().then((users) => {
        if (mounted)
          setSupabaseUsers(
            users.filter((u) => u.status === 'active').map((u) => u.displayName)
          );
      }).catch(() => {});
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const notifiedKeys = loadNotifiedReminderKeys();
    const due = getDueReminderCandidates(tasks, Date.now(), notifiedKeys);
    if (due.length === 0) return;

    due.forEach(({ task, reminder, notificationKey }) => {
      notifiedKeys.add(notificationKey);
      notify(
        'Task Reminder',
        `${reminder.label} · ${task.ownerId}: ${task.title}`,
        task.priority === 'Critical' ? 'red' : 'orange',
        '/priority-board',
      );
    });
    saveNotifiedReminderKeys(notifiedKeys);
  }, [tasks]);

  const campaigns = filterCampaignsByRole(role, dataService.getCampaigns());
  const owners = filterOwnerOptionsByRole(
    role,
    Array.from(
      new Set([
        ...TEAM_MEMBERS,
        ...supabaseUsers,
        ...tasks.map((t) => t.ownerId?.trim()).filter(Boolean) as string[],
      ])
    )
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const ownerId = task.ownerId?.trim() || 'Unassigned';
      const haystack =
        `${task.title || ''} ${task.description || ''} ${ownerId} ${task.campaignId || ''}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesOwner = ownerFilter === 'all' || ownerId === ownerFilter;
      const matchesStatus = showCompleted ? true : !task.completed;
      return matchesQuery && matchesOwner && matchesStatus;
    });
  }, [tasks, query, ownerFilter, showCompleted]);

  const tasksByPriority = useMemo(() => {
    return PRIORITIES.reduce((acc, priority) => {
      acc[priority] = filteredTasks
        .filter((t) => t.priority === priority)
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return toValidTimestamp(a.dueDate) - toValidTimestamp(b.dueDate);
        });
      return acc;
    }, {} as Record<Task['priority'], Task[]>);
  }, [filteredTasks]);

  const totalActive = tasks.filter((t) => !t.completed).length;
  const totalOverdue = tasks.filter(isTaskOverdue).length;
  const criticalCount = tasks.filter(
    (t) => t.priority === 'Critical' && !t.completed
  ).length;
  const dailyCount = tasks.filter((t) => t.dailyTaskDate).length;

  const openCreateFor = (priority: Task['priority']) => {
    setCreateForPriority(priority);
    setDraft({ ...emptyDraft(), priority, ownerId: owners[0] || '' });
    setShowCreate(true);
  };

  const saveTask = () => {
    if (!draft.title?.trim()) return;
    const task: Task = {
      id: `TSK-${Date.now()}`,
      title: draft.title || '',
      description: draft.description || '',
      ownerId: draft.ownerId?.trim() || 'Ops',
      campaignId: draft.campaignId?.trim() || 'Generic Ops',
      priority: draft.priority || 'Medium',
      dueDate: toValidTimestamp(draft.dueDate),
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'admin',
    };
    setTasks(dataService.addTask(task));
    notify(
      'Task Created',
      `"${task.title}" · ${task.priority} priority`,
      'green',
      '/priority-board'
    );
    setShowCreate(false);
    setDraft(emptyDraft());
  };

  const toggleComplete = (task: Task) => {
    const next = !task.completed;
    const patch = next
      ? completeDailyTask(task)
      : {
          ...task,
          completed: false,
          completedAt: undefined,
          updatedAt: Date.now(),
          flags: (task.flags || []).map((flag) => ({ ...flag, resolved: false })),
        };
    const updated = filterTasksByRole(
      role,
      dataService.updateTask(task.id, patch)
    );
    setTasks(updated);
    notify(
      next ? 'Task Done' : 'Task Reopened',
      next
        ? `"${task.title}" completed by ${task.ownerId}`
        : `"${task.title}" returned to active`,
      next ? 'green' : 'orange',
      '/priority-board'
    );
  };

  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks(filterTasksByRole(role, dataService.deleteTask(id)));
    if (task)
      notify('Task Deleted', `"${task.title}" removed`, 'red', '/priority-board');
    setConfirmDeleteId(null);
  };

  return (
    <div className="max-w-[1480px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">
            Core Operations
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight text-foreground">
            Priority Board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks organized by urgency — triage and act on the highest impact work first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncDailyTasks('manual')}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gc-orange px-4 text-xs font-extrabold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-gc-orange/90"
          title={lastDailySync ? `Last synced ${lastDailySync}` : 'Sync daily tasks'}
        >
          <RefreshCw size={14} />
          Sync Daily Tasks
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active" value={totalActive} color="text-gc-orange" />
        <StatCard label="Overdue" value={totalOverdue} color="text-red-600" />
        <StatCard label="Critical" value={criticalCount} color="text-red-600" />
        <StatCard label="Daily Tasks" value={dailyCount} color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="settings-input pl-9"
            placeholder="Search tasks, owners, campaigns..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="settings-input min-w-36"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="all">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className={cn(
              'h-5 w-9 rounded-full p-0.5 transition-colors',
              showCompleted ? 'bg-gc-orange' : 'bg-border'
            )}
          >
            <span
              className={cn(
                'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                showCompleted && 'translate-x-4'
              )}
            />
          </button>
          Show completed
        </label>
      </div>

      {/* Create task modal */}
      {showCreate && (
        <div className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm dark:border-orange-900/30 dark:bg-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">
                New Task
              </p>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <PriorityDot priority={createForPriority} />
                {createForPriority} Priority
              </h3>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="icon-btn"
            >
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldInput
              label="Title"
              value={draft.title || ''}
              onChange={(v) => setDraft({ ...draft, title: v })}
            />
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Assignee
              </span>
              <input
                className="settings-input"
                list="pb-owner-options"
                placeholder="Type or select a team member..."
                value={draft.ownerId || ''}
                onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}
              />
              <datalist id="pb-owner-options">
                {owners.map((o) => <option key={o} value={o} />)}
              </datalist>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Priority
              </span>
              <select
                className="settings-input"
                value={draft.priority || 'Medium'}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value as Task['priority'] })
                }
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Due Date
              </span>
              <input
                className="settings-input"
                type="date"
                value={formatDueDate(draft.dueDate, 'yyyy-MM-dd')}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: parseDateInput(e.target.value, draft.dueDate) })
                }
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Campaign
              </span>
              <input
                className="settings-input"
                list="pb-campaign-options"
                value={draft.campaignId || ''}
                onChange={(e) => setDraft({ ...draft, campaignId: e.target.value })}
              />
              <datalist id="pb-campaign-options">
                {campaigns.map((c) => (
                  <option key={c.id} value={`${c.id} - ${c.name}`} />
                ))}
              </datalist>
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Description
              </span>
              <textarea
                className="settings-input min-h-20"
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={saveTask}
              className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90"
            >
              <Save size={15} />
              Save Task
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PRIORITIES.map((priority) => {
          const cfg = PRIORITY_CONFIG[priority];
          const Icon = cfg.icon;
          const columnTasks = tasksByPriority[priority] || [];
          const activeInColumn = columnTasks.filter((t) => !t.completed).length;

          return (
            <div
              key={priority}
              className="flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Column header */}
              <div className={cn('px-4 py-3', cfg.headerBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={cfg.color} />
                    <span className={cn('text-sm font-extrabold tracking-tight', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        cfg.badge
                      )}
                    >
                      {activeInColumn}
                    </span>
                  </div>
                  <button
                    onClick={() => openCreateFor(priority)}
                    className={cn(
                      'rounded-lg p-1.5 transition-colors',
                      cfg.bg,
                      cfg.color,
                      'hover:opacity-80'
                    )}
                    title={`Add ${priority} task`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Column body */}
              <div className="flex-1 divide-y divide-border overflow-y-auto max-h-[640px]">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        cfg.bg
                      )}
                    >
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      No {priority.toLowerCase()} tasks
                    </p>
                    <button
                      onClick={() => openCreateFor(priority)}
                      className={cn(
                        'text-[11px] font-bold underline underline-offset-2',
                        cfg.color
                      )}
                    >
                      + Add one
                    </button>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const overdue = isTaskOverdue(task);
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        overdue={overdue}
                        cfg={cfg}
                        confirmDeleteId={confirmDeleteId}
                        setConfirmDeleteId={setConfirmDeleteId}
                        onToggle={() => toggleComplete(task)}
                        onDelete={() => deleteTask(task.id)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  overdue,
  cfg,
  confirmDeleteId,
  setConfirmDeleteId,
  onToggle,
  onDelete,
}: {
  task: Task;
  overdue: boolean;
  cfg: (typeof PRIORITY_CONFIG)[Task['priority']];
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const ownerId = task.ownerId?.trim() || 'Unassigned';
  const nextReminder = task.reminders
    ?.filter((reminder) => reminder.dueAt >= Date.now())
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  const openFlags = task.flags?.filter((flag) => !flag.resolved).slice(0, 3) || [];

  return (
    <div
      className={cn(
        'group px-4 py-3 transition-colors',
        task.completed && 'opacity-60',
        overdue && !task.completed && 'bg-red-50/40 dark:bg-red-900/10'
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            task.completed
              ? 'border-green-500 bg-green-500 text-white'
              : `border-current ${cfg.color} hover:bg-current/10`
          )}
          aria-label={task.completed ? 'Reopen task' : 'Complete task'}
        >
          {task.completed && <CheckCircle2 size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-bold leading-snug',
              task.completed
                ? 'line-through text-muted-foreground'
                : 'text-foreground'
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.department && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gc-orange/10 px-2 py-0.5 text-[10px] font-bold text-gc-orange">
                <CalendarCheck size={9} />
                {task.department}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">
              {ownerId}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                overdue && !task.completed
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              <Clock size={9} />
              {format(
                isValid(new Date(task.dueDate))
                  ? new Date(task.dueDate)
                  : new Date(),
                'MMM dd'
              )}
              {overdue && !task.completed && ' · Overdue'}
            </span>
            {nextReminder && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                <BellRing size={9} />
                {format(new Date(nextReminder.dueAt), 'HH:mm')}
              </span>
            )}
          </div>
          {(task.output || task.kpi) && (
            <div className="mt-2 space-y-1 rounded-lg border border-border bg-background/60 p-2">
              {task.output && (
                <p className="text-[10.5px] font-semibold leading-relaxed text-foreground">
                  {task.output}
                </p>
              )}
              {task.kpi && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  KPI: {task.kpi}
                </p>
              )}
            </div>
          )}
          {openFlags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {openFlags.map((flag) => (
                <span
                  key={flag.id}
                  className="inline-flex items-center gap-1 rounded-md border border-orange-100 bg-orange-50 px-1.5 py-0.5 text-[9.5px] font-bold text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-300"
                >
                  <Flag size={8} />
                  {flag.label}
                </span>
              ))}
            </div>
          )}
          {task.campaignId && task.campaignId !== 'Generic Ops' && (
            <p className="mt-1 text-[10px] text-muted-foreground truncate">
              {task.campaignId}
            </p>
          )}
        </div>

        {confirmDeleteId === task.id ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDelete}
              className="rounded bg-destructive px-2 py-1 text-[10px] font-bold text-white hover:bg-destructive/90"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="rounded border border-border px-2 py-1 text-[10px] font-bold hover:bg-accent"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeleteId(task.id)}
            className="mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 hover:opacity-100"
            aria-label="Delete task"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: Task['priority'] }) {
  const colors = {
    Critical: 'bg-red-500',
    High: 'bg-gc-orange',
    Medium: 'bg-amber-500',
    Low: 'bg-green-500',
  };
  return (
    <span className={cn('inline-block h-3 w-3 rounded-full', colors[priority])} />
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', color)}>{value}</p>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        className="settings-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
