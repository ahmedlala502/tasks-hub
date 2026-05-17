/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Archive,
  Ban,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Clock3,
  Flame,
  Layers3,
  ListChecks,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { format, isPast, isValid } from 'date-fns';
import { useAuth } from '../App';
import { filterCampaignsByRole, filterTasksByRole } from '../lib/workspace';
import { getDefaultPlatformUserNames, loadPlatformUserNames, sortUniqueUserNames } from '../lib/platformUsers';
import {
  TASK_BUCKET_LABELS,
  buildCampaignTaskGroups,
  buildTaskBucketSummaries,
  filterTasksByBucket,
  getTaskBucket,
  validateTaskCampaign,
  type CampaignTaskGroup,
  type TaskBucket,
} from '../lib/taskInsights';
import { cn } from '../utils';
import { dataService } from '../services/dataService';
import { notify } from '../services/notificationService';
import { Task } from '../types';
import { BulkUploadButton } from '../components/BulkUploadDialog';
import { rowsToTasks } from '../services/spreadsheetService';

const PRIORITIES: Task['priority'][] = ['Low', 'Medium', 'High', 'Critical'];
const ONE_DAY = 86400000;
const BUCKETS: TaskBucket[] = ['all', 'done', 'in-progress', 'pending', 'blocked', 'new'];

const fallbackDueDate = () => Date.now() + ONE_DAY;

const toValidDate = (value: unknown, fallback = fallbackDueDate()) => {
  const ts = typeof value === 'number' ? value : Number(value);
  const d = new Date(ts);
  return isValid(d) ? d : new Date(fallback);
};

const toValidTimestamp = (value: unknown, fallback = fallbackDueDate()) =>
  toValidDate(value, fallback).getTime();

const fmt = (value: unknown, f: string) => format(toValidDate(value), f);

const formatDateInput = (value: unknown) => fmt(value, 'yyyy-MM-dd');

const formatTimeInput = (value: unknown) => fmt(value, 'HH:mm');

const parseDateTimeInput = (dateValue: string, timeValue: string, fallback: unknown) => {
  if (!dateValue) return toValidTimestamp(fallback);
  const safeTime = timeValue || formatTimeInput(fallback);
  const ts = new Date(`${dateValue}T${safeTime || '12:00'}`).getTime();
  return Number.isFinite(ts) ? ts : toValidTimestamp(fallback);
};

const isOverdue = (task: Task) => !task.completed && isPast(toValidDate(task.dueDate));

const formatSla = (task: Pick<Task, 'slaHrs' | 'dueDate'>) => {
  if (task.slaHrs && task.slaHrs > 0) return `${task.slaHrs}h`;
  const hours = Math.max(1, Math.round((toValidTimestamp(task.dueDate) - Date.now()) / 3_600_000));
  return `${hours}h left`;
};

const emptyDraft = (): Partial<Task> => ({
  title: '',
  description: '',
  ownerId: '',
  campaignId: '',
  priority: 'Medium',
  dueDate: fallbackDueDate(),
  completed: false,
});

const PRIORITY_CONFIG: Record<string, { dot: string; badge: string }> = {
  Critical: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  High: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
  Medium: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
  Low: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
};

const BUCKET_STYLE: Record<TaskBucket, { icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; ring: string }> = {
  all: { icon: Archive, tone: 'text-slate-700 dark:text-slate-200', ring: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30' },
  done: { icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-300', ring: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' },
  'in-progress': { icon: Clock3, tone: 'text-orange-700 dark:text-orange-300', ring: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20' },
  pending: { icon: ListChecks, tone: 'text-amber-700 dark:text-amber-300', ring: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' },
  blocked: { icon: Ban, tone: 'text-red-700 dark:text-red-300', ring: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' },
  new: { icon: CirclePlus, tone: 'text-purple-700 dark:text-purple-300', ring: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20' },
};

function isTaskBucket(value: string | undefined): value is TaskBucket {
  return Boolean(value && BUCKETS.includes(value as TaskBucket));
}

export default function TasksCenter() {
  const { role, user } = useAuth();
  const { bucket } = useParams();
  const navigate = useNavigate();
  const selectedBucket = isTaskBucket(bucket) ? bucket : null;
  const now = Date.now();

  const [tasks, setTasks] = useState<Task[]>(filterTasksByRole(role, dataService.getTasks()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Task> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<Partial<Task>>(emptyDraft());
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Task['priority']>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [platformUsers, setPlatformUsers] = useState<string[]>(getDefaultPlatformUserNames());
  const [formError, setFormError] = useState('');

  const refreshTasks = () => setTasks(filterTasksByRole(role, dataService.getTasks()));

  useEffect(() => {
    let alive = true;
    loadPlatformUserNames().then(users => {
      if (alive) setPlatformUsers(users);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const campaigns = filterCampaignsByRole(role, dataService.getCampaigns());
  const campaignOptions = Array.from(new Set([
    ...campaigns.map(c => c.name).filter(Boolean),
    ...tasks.map(t => t.campaignId?.trim()).filter(Boolean) as string[],
  ])).sort((a, b) => a.localeCompare(b));
  const owners = useMemo(
    () => sortUniqueUserNames([...platformUsers, user?.displayName]),
    [platformUsers, user?.displayName],
  );

  const bucketTasks = useMemo(() => (
    selectedBucket ? filterTasksByBucket(tasks, selectedBucket, now) : tasks
  ), [tasks, selectedBucket, now]);

  const filtered = useMemo(() => {
    const pw: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return bucketTasks
      .filter(t => {
        const owner = t.ownerId?.trim() || 'Unassigned';
        const hay = `${t.title} ${t.description} ${owner} ${t.campaignId}`.toLowerCase();
        return (
          (!query || hay.includes(query.toLowerCase())) &&
          (ownerFilter === 'all' || owner === ownerFilter) &&
          (statusFilter === 'all' || (statusFilter === 'completed' ? t.completed : !t.completed)) &&
          (priorityFilter === 'all' || t.priority === priorityFilter)
        );
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (pw[b.priority] !== pw[a.priority]) return pw[b.priority] - pw[a.priority];
        return toValidTimestamp(a.dueDate) - toValidTimestamp(b.dueDate);
      });
  }, [bucketTasks, query, ownerFilter, statusFilter, priorityFilter]);

  const summaries = useMemo(() => buildTaskBucketSummaries(tasks, now), [tasks, now]);
  const campaignGroups = useMemo(() => buildCampaignTaskGroups(selectedBucket ? filtered : tasks, now), [filtered, tasks, selectedBucket, now]);

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditDraft({ ...task, dueDate: toValidTimestamp(task.dueDate) });
    setConfirmDeleteId(null);
    setFormError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setFormError('');
  };

  const saveEdit = () => {
    if (!editingId || !editDraft?.title?.trim()) return;
    const campaignCheck = validateTaskCampaign(editDraft);
    if (!campaignCheck.ok) {
      setFormError(campaignCheck.message);
      return;
    }

    dataService.updateTask(editingId, {
      title: editDraft.title.trim(),
      description: editDraft.description || '',
      ownerId: editDraft.ownerId?.trim() || '',
      campaignId: editDraft.campaignId?.trim() || '',
      priority: editDraft.priority || 'Medium',
      dueDate: toValidTimestamp(editDraft.dueDate),
      slaHrs: Number(editDraft.slaHrs) || undefined,
      completed: Boolean(editDraft.completed),
    });
    refreshTasks();
    notify('Task Updated', `"${editDraft.title.trim()}" saved`, 'orange', selectedBucket ? `/tasks/${selectedBucket}` : '/tasks/all');
    setEditingId(null);
    setEditDraft(null);
    setFormError('');
  };

  const toggleComplete = (task: Task) => {
    dataService.updateTask(task.id, { completed: !task.completed, completedAt: task.completed ? undefined : Date.now(), updatedAt: Date.now() });
    refreshTasks();
    notify(
      task.completed ? 'Task Reopened' : 'Task Completed',
      `"${task.title}" ${task.completed ? 'returned to active' : 'marked complete'}`,
      task.completed ? 'orange' : 'green',
      selectedBucket ? `/tasks/${selectedBucket}` : '/tasks/all',
    );
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    dataService.deleteTask(id);
    refreshTasks();
    if (task) notify('Task Deleted', `"${task.title}" removed`, 'red', selectedBucket ? `/tasks/${selectedBucket}` : '/tasks/all');
    if (editingId === id) cancelEdit();
    setConfirmDeleteId(null);
  };

  const saveCreate = () => {
    if (!createDraft.title?.trim()) return;
    const campaignCheck = validateTaskCampaign(createDraft);
    if (!campaignCheck.ok) {
      setFormError(campaignCheck.message);
      return;
    }

    const task: Task = {
      id: `TSK-${Date.now()}`,
      title: createDraft.title.trim(),
      description: createDraft.description || '',
      ownerId: createDraft.ownerId?.trim() || '',
      campaignId: createDraft.campaignId?.trim() || '',
      priority: createDraft.priority || 'Medium',
      dueDate: toValidTimestamp(createDraft.dueDate),
      slaHrs: Number(createDraft.slaHrs) || undefined,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: user?.displayName || 'Workspace User',
    };
    dataService.addTask(task);
    refreshTasks();
    notify('Task Created', `"${task.title}" added to ${task.campaignId}`, 'green', '/tasks/new');
    setShowCreate(false);
    setCreateDraft(emptyDraft());
    setFormError('');
    navigate('/tasks/new');
  };

  return (
    <div className="mx-auto max-w-[1360px] space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Core Operations</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {selectedBucket ? TASK_BUCKET_LABELS[selectedBucket] : 'Old Tasks'}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckSquare size={15} className="text-gc-orange" />
            {selectedBucket
              ? 'Work inside this dedicated lane, then review its campaign sequence below.'
              : 'Choose a clickable widget to open a dedicated task lane.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedBucket && (
            <Link
              to="/tasks"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-extrabold uppercase tracking-widest text-muted-foreground hover:border-gc-orange hover:text-gc-orange"
            >
              <ArrowLeft size={15} /> Widgets
            </Link>
          )}
          <button
            onClick={() => { setShowCreate(true); setCreateDraft(emptyDraft()); cancelEdit(); }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gc-orange px-4 text-sm font-bold text-white hover:bg-gc-orange/90"
          >
            <Plus size={16} /> New Task
          </button>
          <BulkUploadButton<Task>
            title="Bulk Import Tasks"
            templateHeaders={['id','title','description','campaignId','ownerId','dueDate','slaHrs','priority','status','department','category']}
            parse={rowsToTasks}
            validate={t => {
              const errs: string[] = [];
              if (!t.title) errs.push('Missing title');
              if (!t.ownerId) errs.push('Missing ownerId');
              return errs;
            }}
            commit={async items => {
              const { inserted, updated } = dataService.upsertTasks(items);
              refreshTasks();
              notify('Tasks Imported', `${inserted} added, ${updated} updated.`, 'green', '/tasks');
              return { inserted, updated };
            }}
          />
        </div>
      </div>

      {showCreate && (
        <CreateForm
          draft={createDraft}
          setDraft={(updater) => { setFormError(''); setCreateDraft(updater); }}
          owners={owners}
          campaignOptions={campaignOptions}
          error={formError}
          onSave={saveCreate}
          onCancel={() => { setShowCreate(false); setCreateDraft(emptyDraft()); setFormError(''); }}
        />
      )}

      {!selectedBucket ? (
        <>
          <TaskWidgetGrid summaries={summaries} />
          <CampaignSequenceSection groups={campaignGroups} />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MiniMetric label="Lane Tasks" value={filtered.length} />
            <MiniMetric label="Campaigns" value={campaignGroups.length} />
            <MiniMetric label="Blocked Here" value={filtered.filter(task => getTaskBucket(task, now) === 'blocked').length} tone="text-red-600" />
          </div>

          <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="relative min-w-48 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="settings-input w-full pl-9"
                placeholder="Search tasks..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select className="settings-input min-w-40" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
              <option value="all">All assignees</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="settings-input min-w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <PrioritySelect value={priorityFilter} onChange={v => setPriorityFilter(v as any)} />
          </div>

          <TaskTable
            tasks={filtered}
            allTaskCount={tasks.length}
            editingId={editingId}
            editDraft={editDraft}
            setEditDraft={(updater) => { setFormError(''); setEditDraft(updater); }}
            owners={owners}
            campaignOptions={campaignOptions}
            confirmDeleteId={confirmDeleteId}
            formError={formError}
            onStartEdit={startEdit}
            onToggleComplete={toggleComplete}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onDeleteAsk={setConfirmDeleteId}
            onConfirmDelete={deleteTask}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />

          <CampaignSequenceSection groups={campaignGroups} />
        </>
      )}
    </div>
  );
}

function TaskWidgetGrid({ summaries }: { summaries: ReturnType<typeof buildTaskBucketSummaries> }) {
  const { role } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hiddenBuckets, setHiddenBuckets] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('GC_HIDDEN_TASK_WIDGETS');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  const toggleBucket = (bucket: string) => {
    const next = new Set(hiddenBuckets);
    if (next.has(bucket)) next.delete(bucket);
    else next.add(bucket);
    setHiddenBuckets(next);
    localStorage.setItem('GC_HIDDEN_TASK_WIDGETS', JSON.stringify([...next]));
    notify('Widget Filter Updated', `Visibility for ${bucket} changed`, 'orange', '/tasks');
  };

  const visibleSummaries = summaries.filter(s => !hiddenBuckets.has(s.bucket));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {isCollapsed ? 'Show Task Statistics' : 'Hide Task Statistics'}
        </button>
        
        {role === 'master' && !isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase mr-2">Master Visibility:</span>
            {summaries.map(s => (
              <button
                key={s.bucket}
                onClick={() => toggleBucket(s.bucket)}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-black uppercase border transition-all",
                  hiddenBuckets.has(s.bucket) 
                    ? "bg-red-50 text-red-600 border-red-200" 
                    : "bg-green-50 text-green-600 border-green-200"
                )}
              >
                {s.bucket}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSummaries.map((summary) => {
            const Icon = BUCKET_STYLE[summary.bucket].icon;
            return (
              <Link
                key={summary.bucket}
                to={`/tasks/${summary.bucket}`}
                className={cn(
                  'group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gc-orange hover:shadow-md',
                  summary.bucket === 'all' && 'sm:col-span-2 xl:col-span-1',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg border', BUCKET_STYLE[summary.bucket].ring)}>
                    <Icon size={20} className={BUCKET_STYLE[summary.bucket].tone} />
                  </div>
                  <span className="text-3xl font-black tabular-nums text-foreground">{summary.count}</span>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-foreground">{summary.label}</h3>
                  </div>
                  <p className="mt-1 min-h-10 text-sm font-medium text-muted-foreground">{summary.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-gc-orange">
                  Open lane <ArrowLeft size={13} className="rotate-180 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
          {visibleSummaries.length === 0 && (
            <div className="col-span-full py-8 text-center border-2 border-dashed border-border rounded-xl">
              <p className="text-sm font-bold text-muted-foreground">All summary widgets are hidden. Use Master Visibility to restore them.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskTable({
  tasks,
  allTaskCount,
  editingId,
  editDraft,
  setEditDraft,
  owners,
  campaignOptions,
  confirmDeleteId,
  formError,
  onStartEdit,
  onToggleComplete,
  onSaveEdit,
  onCancelEdit,
  onDeleteAsk,
  onConfirmDelete,
  onCancelDelete,
}: {
  tasks: Task[];
  allTaskCount: number;
  editingId: string | null;
  editDraft: Partial<Task> | null;
  setEditDraft: React.Dispatch<React.SetStateAction<Partial<Task> | null>>;
  owners: string[];
  campaignOptions: string[];
  confirmDeleteId: string | null;
  formError: string;
  onStartEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteAsk: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="hidden grid-cols-[2rem_1fr_10rem_10rem_12rem_8rem_7rem_9rem_8rem] items-center gap-x-4 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
          <span />
          <span>Task</span>
          <span>Assignee</span>
          <span>Creator</span>
          <span>Campaign *</span>
          <span>Priority</span>
        <span>SLA</span>
        <span>Due Date & Time</span>
        <span>Status</span>
      </div>

      <div className="divide-y divide-border">
        {tasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {allTaskCount === 0 ? 'No tasks yet. Create your first task above.' : 'No tasks match these filters.'}
          </div>
        ) : (
          tasks.map(task => {
            const editing = editingId === task.id;
            const overdue = isOverdue(task);
            const deleting = confirmDeleteId === task.id;

            if (editing && editDraft) {
              return (
                <EditRow
                  key={task.id}
                  draft={editDraft}
                  setDraft={setEditDraft}
                  owners={owners}
                  campaignOptions={campaignOptions}
                  error={formError}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  onDelete={() => onDeleteAsk(task.id)}
                  confirmDelete={deleting}
                  onConfirmDelete={() => onConfirmDelete(task.id)}
                  onCancelDelete={onCancelDelete}
                />
              );
            }

            return (
              <TaskDisplayRow
                key={task.id}
                task={task}
                overdue={overdue}
                onStartEdit={onStartEdit}
                onToggleComplete={onToggleComplete}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskDisplayRow({
  task,
  overdue,
  onStartEdit,
  onToggleComplete,
}: {
  task: Task;
  overdue: boolean;
  onStartEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}) {
  const bucket = getTaskBucket(task);
  return (
    <div
      onClick={() => onStartEdit(task)}
      className={cn(
        'grid cursor-pointer grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors md:grid-cols-[2rem_1fr_10rem_10rem_12rem_8rem_7rem_9rem_8rem]',
        'hover:bg-muted/40',
        task.completed && 'opacity-60',
        overdue && !task.completed && 'bg-red-50/50 dark:bg-red-950/20',
      )}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggleComplete(task); }}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors',
          task.completed ? 'border-green-600 bg-green-600 text-white' : 'border-border text-transparent hover:border-gc-orange',
        )}
        aria-label={task.completed ? 'Reopen' : 'Complete'}
      >
        <Check size={13} strokeWidth={3} />
      </button>

      <div className="min-w-0">
        <p className={cn('truncate text-sm font-semibold text-foreground', task.completed && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        {task.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>}
      </div>

      <Cell label="Assignee">{task.ownerId || <span className="text-muted-foreground">Unassigned</span>}</Cell>
      <Cell label="Creator">{task.createdBy || <span className="text-muted-foreground">Unknown</span>}</Cell>
      <Cell label="Campaign">{task.campaignId || <span className="font-bold text-red-600">Required</span>}</Cell>

      <div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold', PRIORITY_CONFIG[task.priority]?.badge)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_CONFIG[task.priority]?.dot)} />
          {task.priority}
        </span>
      </div>

      <Cell label="SLA">{formatSla(task)}</Cell>

      <div className={cn('text-sm', overdue && !task.completed ? 'font-semibold text-red-600' : 'text-foreground')}>
        <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground md:hidden">Due:</span>
        <span className="inline-flex items-center gap-1">
          {overdue && !task.completed && <Clock3 size={12} />}
          {fmt(task.dueDate, 'MMM d, yyyy h:mm a')}
        </span>
      </div>

      <StatusBadge bucket={bucket} />
    </div>
  );
}

function EditRow({
  draft,
  setDraft,
  owners,
  campaignOptions,
  error,
  onSave,
  onCancel,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  draft: Partial<Task>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Task> | null>>;
  owners: string[];
  campaignOptions: string[];
  error: string;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const rowId = draft.id || 'edit';
  return (
    <div className="border-l-4 border-gc-orange bg-orange-50/40 dark:bg-orange-950/10">
      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1fr_11rem_12rem_9rem_7rem_9rem_7rem]">
        <Field label="Title">
          <input
            autoFocus
            className="settings-input"
            value={draft.title || ''}
            onChange={e => setDraft(d => ({ ...d!, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          />
        </Field>

        <Field label="Assignee">
          <select className="settings-input" value={draft.ownerId || ''} onChange={e => setDraft(d => ({ ...d!, ownerId: e.target.value }))}>
            <option value="">Select assignee...</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="Campaign *">
          <select className={cn('settings-input', !draft.campaignId?.trim() && 'border-red-300 focus:border-red-500')} value={draft.campaignId || ''} onChange={e => setDraft(d => ({ ...d!, campaignId: e.target.value }))}>
            <option value="">Select campaign...</option>
            {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Priority">
          <select className="settings-input" value={draft.priority || 'Medium'} onChange={e => setDraft(d => ({ ...d!, priority: e.target.value as Task['priority'] }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="SLA Hours">
          <input
            className="settings-input"
            type="number"
            min="0.25"
            step="0.25"
            placeholder="Duration"
            value={draft.slaHrs ?? ''}
            onChange={e => setDraft(d => ({ ...d!, slaHrs: e.target.value ? Number(e.target.value) : undefined }))}
          />
        </Field>

        <Field label="Due Date & Time">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="settings-input"
              type="date"
              value={formatDateInput(draft.dueDate)}
              onChange={e => setDraft(d => ({ ...d!, dueDate: parseDateTimeInput(e.target.value, formatTimeInput(d?.dueDate), d?.dueDate) }))}
            />
            <input
              className="settings-input"
              type="time"
              value={formatTimeInput(draft.dueDate)}
              onChange={e => setDraft(d => ({ ...d!, dueDate: parseDateTimeInput(formatDateInput(d?.dueDate), e.target.value, d?.dueDate) }))}
            />
          </div>
        </Field>

        <Field label="Status">
          <select className="settings-input" value={draft.completed ? 'completed' : 'active'} onChange={e => setDraft(d => ({ ...d!, completed: e.target.value === 'completed' }))}>
            <option value="active">Open</option>
            <option value="completed">Done</option>
          </select>
        </Field>
      </div>

      <div className="px-4 pb-3">
        <Field label="Description">
          <textarea className="settings-input min-h-16 resize-none" value={draft.description || ''} onChange={e => setDraft(d => ({ ...d!, description: e.target.value }))} rows={2} />
        </Field>
      </div>

      {error && <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 px-4 py-3 dark:border-orange-900/30">
        <div className="flex flex-wrap items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs font-bold text-destructive">Delete this task?</span>
              <button onClick={onConfirmDelete} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white hover:bg-destructive/90">Yes, delete</button>
              <button onClick={onCancelDelete} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-accent">Cancel</button>
            </>
          ) : (
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-accent"><X size={13} className="mr-1 inline" />Cancel</button>
          <button onClick={onSave} className="inline-flex items-center gap-1.5 rounded-lg bg-gc-orange px-4 py-1.5 text-xs font-bold text-white hover:bg-gc-orange/90"><Save size={13} /> Save</button>
        </div>
      </div>
    </div>
  );
}

function CreateForm({
  draft,
  setDraft,
  owners,
  campaignOptions,
  error,
  onSave,
  onCancel,
}: {
  draft: Partial<Task>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Task>>>;
  owners: string[];
  campaignOptions: string[];
  error: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/40 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/10">
      <div className="flex items-center justify-between border-b border-orange-100 px-4 py-3 dark:border-orange-900/30">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">New Task</p>
          <p className="text-sm font-bold text-foreground">Campaign is mandatory before this task can be saved</p>
        </div>
        <button onClick={onCancel} className="icon-btn"><X size={15} /></button>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Title *" className="lg:col-span-2">
          <input autoFocus className="settings-input" placeholder="What needs to be done?" value={draft.title || ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') onSave(); }} />
        </Field>

        <Field label="Assignee">
          <select className="settings-input" value={draft.ownerId || ''} onChange={e => setDraft(d => ({ ...d, ownerId: e.target.value }))}>
            <option value="">Select assignee...</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="Campaign *">
          <input
            className={cn('settings-input', !draft.campaignId?.trim() && 'border-red-300 focus:border-red-500')}
            list="create-campaigns"
            placeholder="Required campaign"
            value={draft.campaignId || ''}
            onChange={e => setDraft(d => ({ ...d, campaignId: e.target.value }))}
          />
          <datalist id="create-campaigns">{campaignOptions.map(c => <option key={c} value={c} />)}</datalist>
        </Field>

        <Field label="Priority">
          <select className="settings-input" value={draft.priority || 'Medium'} onChange={e => setDraft(d => ({ ...d, priority: e.target.value as Task['priority'] }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Due Date & Time">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="settings-input"
              type="date"
              value={formatDateInput(draft.dueDate)}
              onChange={e => setDraft(d => ({ ...d, dueDate: parseDateTimeInput(e.target.value, formatTimeInput(d.dueDate), d.dueDate) }))}
            />
            <input
              className="settings-input"
              type="time"
              value={formatTimeInput(draft.dueDate)}
              onChange={e => setDraft(d => ({ ...d, dueDate: parseDateTimeInput(formatDateInput(d.dueDate), e.target.value, d.dueDate) }))}
            />
          </div>
        </Field>

        <Field label="SLA Hours">
          <input
            className="settings-input"
            type="number"
            min="0.25"
            step="0.25"
            placeholder="Duration"
            value={draft.slaHrs ?? ''}
            onChange={e => setDraft(d => ({ ...d, slaHrs: e.target.value ? Number(e.target.value) : undefined }))}
          />
        </Field>

        <Field label="Description" className="lg:col-span-3">
          <textarea className="settings-input min-h-16 resize-none" placeholder="Optional details..." value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} />
        </Field>
      </div>

      {error && <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-orange-100 px-4 py-3 dark:border-orange-900/30">
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
        <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">
          <Save size={15} /> Create Task
        </button>
      </div>
    </div>
  );
}

function CampaignSequenceSection({ groups }: { groups: CampaignTaskGroup[] }) {
  const completionRate = (done: number, total: number) => total > 0 ? Math.round((done / total) * 100) : 0;

  const getCampaignHealth = (group: CampaignTaskGroup) => {
    const rate = completionRate(group.done, group.total);
    if (rate >= 80) return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'On Track' };
    if (rate >= 50) return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'At Risk' };
    if (group.blocked > 0) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Blocked' };
    return { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: 'Slow' };
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-gc-orange">
            <Layers3 size={16} /> Campaign Operations
          </div>
          <h3 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">Campaign Task Sequences</h3>
          <p className="mt-1 text-sm text-muted-foreground">Tasks organized by campaign with progress tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-border bg-background px-4 py-2">
            <div className="text-2xl font-bold text-foreground">{groups.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaigns</div>
          </div>
          <div className="rounded-lg border border-gc-orange/20 bg-gc-orange/5 px-4 py-2">
            <div className="text-2xl font-bold text-gc-orange">{groups.reduce((sum, g) => sum + g.total, 0)}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gc-orange">Total Tasks</div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
          <Layers3 size={48} className="mx-auto mb-4 text-gc-orange/50" />
          <h4 className="text-lg font-bold text-foreground">No Campaign Tasks</h4>
          <p className="mt-1 text-sm text-muted-foreground">Tasks aren't linked to campaigns yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, idx) => {
            const health = getCampaignHealth(group);
            const progress = completionRate(group.done, group.total);
            
            return (
              <div key={group.campaignName} className="group rounded-xl border border-border bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden">
                <div className="border-b border-border bg-gradient-to-r from-muted/30 to-muted/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gc-orange">Campaign #{idx + 1}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase border ${health.bg} ${health.color} ${health.border}`}>{health.label}</span>
                      </div>
                      <h4 className="mt-1 truncate text-sm font-extrabold text-foreground">{group.campaignName}</h4>
                    </div>
                    <div className="flex items-center gap-1 text-right">
                      <div className="text-lg font-bold text-foreground">{group.total}</div>
                      <div className="text-[10px] text-muted-foreground">tasks</div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                      <div className={`h-full transition-all ${progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-gc-orange' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-bold">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={progress === 100 ? 'text-green-600' : 'text-foreground'}>{progress}% Complete</span>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  <div className="grid grid-cols-4 gap-2 bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Task</span>
                    <span className="text-center">Owner</span>
                    <span className="text-center">Status</span>
                    <span className="text-right">Due</span>
                  </div>
                  
                  {group.tasks.slice(0, 5).map((item) => {
                    const priorityDot = item.task.priority === 'Critical' ? 'bg-red-500' : item.task.priority === 'High' ? 'bg-gc-orange' : item.task.priority === 'Medium' ? 'bg-amber-500' : 'bg-green-500';
                    const ownerClass = item.task.ownerId ? 'bg-secondary text-foreground' : 'bg-red-50 text-red-700';
                    const bucketClass = item.bucket === 'done' ? 'bg-green-50 text-green-700' : item.bucket === 'blocked' ? 'bg-red-50 text-red-700' : item.bucket === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700';
                    
                    return (
                      <div key={item.task.id} className="group/item grid grid-cols-4 gap-2 items-center px-3 py-2.5 text-sm transition-colors hover:bg-muted/30">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{item.task.title}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${priorityDot}`} />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.task.priority}</span>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${ownerClass}`}>{item.task.ownerId?.split(' ')[0] || 'Unassigned'}</span>
                        </div>
                        
                        <div className="text-center">
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${bucketClass}`}>{item.bucket}</span>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground">{fmt(item.task.dueDate, 'MMM d')}</div>
                          <div className="text-[10px] text-muted-foreground">{fmt(item.task.dueDate, 'h:mm a')}</div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {group.tasks.length > 5 && (
                    <div className="px-3 py-3 text-center text-xs font-bold text-muted-foreground">
                      <span className="rounded-full bg-secondary px-3 py-1">+{group.tasks.length - 5} more tasks</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <CheckSquare size={12} className="text-gc-orange" />
                      <span className="text-muted-foreground">Completion</span>
                    </div>
                    <span className={progress === 100 ? 'text-green-600' : 'text-foreground'}>{group.done}/{group.total} • {progress}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="truncate text-sm text-foreground">
      <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground md:hidden">{label}: </span>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MiniMetric({ label, value, tone = 'text-foreground' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  );
}

function StatusBadge({ bucket }: { bucket: Exclude<TaskBucket, 'all' | 'new'> }) {
  const label = TASK_BUCKET_LABELS[bucket];
  return (
    <div>
      <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-bold', BUCKET_STYLE[bucket].ring, BUCKET_STYLE[bucket].tone)}>
        {label}
      </span>
    </div>
  );
}

const PRIORITY_DOT: Record<string, string> = {
  Critical: '#dc2626',
  High: '#f97316',
  Medium: '#d97706',
  Low: '#16a34a',
};

function PrioritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative min-w-36">
      {value !== 'all' && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{ background: PRIORITY_DOT[value] }}
        />
      )}
      <select className={cn('settings-input', value !== 'all' && 'pl-8')} value={value} onChange={e => onChange(e.target.value)}>
        <option value="all">All priorities</option>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}
