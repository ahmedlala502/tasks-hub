import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowUpCircle, BellRing, CheckCircle2, Circle,
  Clock, Edit2, Flag, FolderKanban, Layers3, Plus, RefreshCw,
  Save, Search, Trash2, X, LayoutGrid, Check, ChevronDown, ChevronUp,
  User, Calendar, MapPin, DollarSign, Target
} from 'lucide-react';
import { format, isPast, isValid } from 'date-fns';
import { useAuth } from '../App';
import { filterCampaignsByRole, filterOwnerOptionsByRole, filterTasksByRole } from '../lib/workspace';
import { cn } from '../utils';
import { dataService, TEAM_MEMBERS } from '../services/dataService';
import { notify } from '../services/notificationService';
import { Task, Campaign } from '../types';
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

const emptyDraft = (): Partial<Task> => ({
  title: '', description: '', ownerId: '', campaignId: '',
  priority: 'Medium', dueDate: fallbackDueDate(), completed: false,
});

const PRIORITY_CONFIG: Record<Task['priority'], {
  label: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; bg: string; border: string; badge: string; dot: string;
}> = {
  Critical: { label: 'Critical', icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-900/30', badge: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', dot: 'bg-red-500' },
  High: { label: 'High', icon: AlertCircle, color: 'text-gc-orange', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-900/30', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', dot: 'bg-gc-orange' },
  Medium: { label: 'Medium', icon: ArrowUpCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-900/30', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400', dot: 'bg-amber-500' },
  Low: { label: 'Low', icon: Circle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-900/30', badge: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', dot: 'bg-green-500' },
};

interface TaskWithEdit extends Task {
  isEditing?: boolean;
}

export default function PriorityBoard() {
  const { role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>(filterTasksByRole(role, dataService.getTasks()));
  const [campaigns, setCampaigns] = useState<Campaign[]>(filterCampaignsByRole(role, dataService.getCampaigns()));
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<TaskWithEdit | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>(emptyDraft());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [supabaseUsers, setSupabaseUsers] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers().then((users) => {
        if (mounted) setSupabaseUsers(users.filter((u) => u.status === 'active').map((u) => u.displayName));
      }).catch(() => {});
    });
    return () => { mounted = false; };
  }, []);

  const owners = filterOwnerOptionsByRole(role, Array.from(new Set([
    ...TEAM_MEMBERS, ...supabaseUsers, ...tasks.map((t) => t.ownerId?.trim()).filter(Boolean) as string[],
  ])));

  const campaignNames = useMemo(() => campaigns.map((c) => c.name).sort(), [campaigns]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const ownerId = task.ownerId?.trim() || 'Unassigned';
      const haystack = `${task.title || ''} ${task.description || ''} ${ownerId} ${task.campaignId || ''}`.toLowerCase();
      return (!query || haystack.includes(query.toLowerCase()))
        && (ownerFilter === 'all' || ownerId === ownerFilter)
        && (campaignFilter === 'all' || (task.campaignId || '') === campaignFilter)
        && (showCompleted ? true : !task.completed);
    });
  }, [tasks, query, ownerFilter, campaignFilter, showCompleted]);

  const tasksByCampaign = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      const key = t.campaignId?.trim() || 'No Campaign';
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks]);

  const totalActive = tasks.filter((t) => !t.completed).length;
  const totalOverdue = tasks.filter(isTaskOverdue).length;
  const criticalCount = tasks.filter((t) => t.priority === 'Critical' && !t.completed).length;

  const openCreate = () => { setDraft(emptyDraft()); setShowCreate(true); };

  const saveTask = () => {
    if (!draft.title?.trim()) return;
    const task: Task = {
      id: `TSK-${Date.now()}`, title: draft.title || '', description: draft.description || '',
      ownerId: draft.ownerId?.trim() || 'Ops', campaignId: draft.campaignId?.trim() || '',
      priority: draft.priority || 'Medium', dueDate: toValidTimestamp(draft.dueDate),
      completed: false, createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'admin',
    };
    setTasks(dataService.addTask(task));
    notify('Task Created', `"${task.title}" · ${task.priority} priority`, 'green', '/priority-board');
    setShowCreate(false);
    setDraft(emptyDraft());
  };

  const toggleComplete = (task: Task) => {
    const next = !task.completed;
    const patch = next ? completeDailyTask(task) : { ...task, completed: false, completedAt: undefined, updatedAt: Date.now() };
    const updated = filterTasksByRole(role, dataService.updateTask(task.id, patch));
    setTasks(updated);
    notify(next ? 'Task Done' : 'Task Reopened', next ? `"${task.title}" completed` : `"${task.title}" reopened`, next ? 'green' : 'orange', '/priority-board');
  };

  const startEdit = (task: Task) => {
    setEditingTask({ ...task, isEditing: true });
    setDraft({ ...task });
  };

  const saveEdit = () => {
    if (!editingTask || !draft.title?.trim()) return;
    const updated = filterTasksByRole(role, dataService.updateTask(editingTask.id, {
      title: draft.title.trim(),
      description: draft.description || '',
      ownerId: draft.ownerId?.trim() || '',
      campaignId: draft.campaignId?.trim() || '',
      priority: draft.priority || 'Medium',
      dueDate: toValidTimestamp(draft.dueDate),
      updatedAt: Date.now(),
    }));
    setTasks(updated);
    notify('Task Updated', `"${draft.title.trim()}" saved`, 'orange', '/priority-board');
    setEditingTask(null);
    setDraft(emptyDraft());
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setDraft(emptyDraft());
  };

  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks(filterTasksByRole(role, dataService.deleteTask(id)));
    if (task) notify('Task Deleted', `"${task.title}" removed`, 'red', '/priority-board');
    setConfirmDeleteId(null);
  };

  const toggleCampaignExpand = (campaignName: string) => {
    const next = new Set(expandedCampaigns);
    if (next.has(campaignName)) {
      next.delete(campaignName);
    } else {
      next.add(campaignName);
    }
    setExpandedCampaigns(next);
  };

  const getCampaignDetails = (campaignName: string): Campaign | undefined => {
    return campaigns.find((c) => c.name === campaignName);
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Campaign-Centric Operations</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Priority Board</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaign-focused task management. Click campaigns to expand task checklists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gc-orange px-3 text-xs font-bold text-white hover:bg-gc-orange/90">
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active Tasks" value={totalActive} color="text-gc-orange" />
        <StatCard label="Overdue" value={totalOverdue} color="text-red-600" />
        <StatCard label="Critical" value={criticalCount} color="text-red-600" />
        <StatCard label="Campaigns" value={campaigns.length} color="text-purple-600 dark:text-purple-400" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="settings-input pl-9" placeholder="Search tasks, owners, campaigns..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="settings-input min-w-36" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="all">All owners</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="settings-input min-w-36" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
          <option value="all">All campaigns</option>
          {campaignNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap">
          <button type="button" onClick={() => setShowCompleted((v) => !v)} className={cn('h-5 w-9 rounded-full p-0.5 transition-colors', showCompleted ? 'bg-gc-orange' : 'bg-border')}>
            <span className={cn('block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', showCompleted && 'translate-x-4')} />
          </button>
          Show Completed
        </label>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-orange-200 bg-card p-5 shadow-sm dark:border-orange-900/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">New Task</p>
              <h3 className="text-lg font-bold text-foreground">Create Task</h3>
            </div>
            <button onClick={() => setShowCreate(false)} className="icon-btn"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldInput label="Title" value={draft.title || ''} onChange={(v) => setDraft({ ...draft, title: v })} />
            <SelectField label="Assignee" value={draft.ownerId || ''} onChange={(v) => setDraft({ ...draft, ownerId: v })} options={owners} placeholder="Select team member..." />
            <SelectField label="Priority" value={draft.priority || 'Medium'} onChange={(v) => setDraft({ ...draft, priority: v as Task['priority'] })} options={PRIORITIES} />
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</span>
              <input className="settings-input" type="date" value={formatDueDate(draft.dueDate, 'yyyy-MM-dd')} onChange={(e) => setDraft({ ...draft, dueDate: parseDateInput(e.target.value, draft.dueDate) })} />
            </label>
            <SelectField label="Campaign" value={draft.campaignId || ''} onChange={(v) => setDraft({ ...draft, campaignId: v })} options={campaignNames} placeholder="Select campaign..." />
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</span>
              <textarea className="settings-input min-h-20" value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
            <button onClick={saveTask} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90"><Save size={15} /> Save Task</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tasksByCampaign.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border py-12 text-center">
            <FolderKanban size={48} className="mx-auto mb-4 text-gc-orange/50" />
            <h3 className="text-lg font-bold text-foreground">No Tasks Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create tasks or adjust your filters</p>
          </div>
        ) : (
          tasksByCampaign.map(([campaignName, campaignTasks]) => {
            const isExpanded = expandedCampaigns.has(campaignName);
            const campaign = getCampaignDetails(campaignName);
            const completedCount = campaignTasks.filter((t) => t.completed).length;
            const progress = campaignTasks.length > 0 ? Math.round((completedCount / campaignTasks.length) * 100) : 0;
            
            return (
              <div key={campaignName} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all">
                <div
                  className={cn(
                    'flex items-center justify-between px-5 py-4 cursor-pointer transition-colors',
                    isExpanded ? 'bg-gc-orange/5 border-b border-border' : 'hover:bg-muted/30'
                  )}
                  onClick={() => toggleCampaignExpand(campaignName)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center font-condensed font-black text-lg shadow-sm',
                      campaign?.status === 'Active' ? 'bg-gc-orange text-white' :
                      campaign?.status === 'Blocked' ? 'bg-red-500 text-white' :
                      'bg-secondary text-foreground'
                    )}>
                      {campaignName.substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-extrabold text-foreground truncate">{campaignName}</h3>
                        {campaign && (
                          <span className={cn(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                            campaign.status === 'Active' ? 'bg-green-50 text-green-700' :
                            campaign.status === 'Blocked' ? 'bg-red-50 text-red-700' :
                            campaign.status === 'Closed' ? 'bg-secondary text-muted-foreground' :
                            'bg-amber-50 text-amber-700'
                          )}>
                            {campaign.status}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Target size={14} />
                          <span>{campaignTasks.length} tasks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>{completedCount} completed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>{campaignTasks.length - completedCount} pending</span>
                        </div>
                        {campaign && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} />
                              <span>{campaign.city}, {campaign.country}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DollarSign size={14} />
                              <span>${campaign.budget?.toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gc-orange">{progress}%</div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Complete</div>
                    </div>
                    <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-gc-orange transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="bg-muted/30 px-5 py-2.5">
                      <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="col-span-1 text-center">Status</div>
                        <div className="col-span-5">Task</div>
                        <div className="col-span-2 text-center">Assignee</div>
                        <div className="col-span-2 text-center">Priority</div>
                        <div className="col-span-2 text-right">Due Date</div>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                      {campaignTasks.map((task) => {
                        const cfg = PRIORITY_CONFIG[task.priority];
                        const isEditing = editingTask?.id === task.id;
                        
                        if (isEditing && editingTask) {
                          return (
                            <div key={task.id} className="px-5 py-3 bg-orange-50/40 dark:bg-orange-900/10">
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-5 space-y-2">
                                  <input
                                    className="settings-input text-sm font-semibold"
                                    value={draft.title || ''}
                                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                    placeholder="Task title"
                                  />
                                  <textarea
                                    className="settings-input text-xs"
                                    value={draft.description || ''}
                                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                    placeholder="Description"
                                    rows={2}
                                  />
                                </div>
                                
                                <div className="col-span-2">
                                  <select
                                    className="settings-input text-xs"
                                    value={draft.ownerId || ''}
                                    onChange={(e) => setDraft({ ...draft, ownerId: e.target.value })}
                                  >
                                    <option value="">Select assignee...</option>
                                    {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </div>
                                
                                <div className="col-span-2">
                                  <select
                                    className="settings-input text-xs"
                                    value={draft.priority || 'Medium'}
                                    onChange={(e) => setDraft({ ...draft, priority: e.target.value as Task['priority'] })}
                                  >
                                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                                
                                <div className="col-span-2">
                                  <input
                                    className="settings-input text-xs"
                                    type="date"
                                    value={formatDueDate(draft.dueDate, 'yyyy-MM-dd')}
                                    onChange={(e) => setDraft({ ...draft, dueDate: parseDateInput(e.target.value, draft.dueDate) })}
                                  />
                                </div>
                                
                                <div className="col-span-1 flex justify-end gap-2">
                                  <button onClick={saveEdit} className="rounded-lg bg-gc-orange p-2 text-white hover:bg-gc-orange/90">
                                    <Save size={14} />
                                  </button>
                                  <button onClick={cancelEdit} className="rounded-lg border border-border p-2 hover:bg-accent">
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'grid grid-cols-12 gap-4 px-5 py-3 items-center transition-colors hover:bg-muted/30',
                              task.completed && 'opacity-50 bg-muted/20',
                              isTaskOverdue(task) && !task.completed && 'bg-red-50/40 dark:bg-red-900/10'
                            )}
                          >
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleComplete(task); }}
                                className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                                  task.completed
                                    ? 'border-green-500 bg-green-500 text-white'
                                    : `border-current ${cfg.color} hover:bg-current/10`
                                )}
                              >
                                {task.completed && <Check size={12} />}
                              </button>
                            </div>
                            
                            <div className="col-span-5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)} />
                                <p className={cn(
                                  'truncate text-sm font-semibold',
                                  task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                                )}>
                                  {task.title}
                                </p>
                              </div>
                              {task.description && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>
                              )}
                            </div>
                            
                            <div className="col-span-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <User size={12} className="text-muted-foreground" />
                                <span className="text-xs font-semibold">{task.ownerId || 'Unassigned'}</span>
                              </div>
                            </div>
                            
                            <div className="col-span-2 text-center">
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold', cfg.badge)}>
                                <cfg.icon size={10} />
                                {task.priority}
                              </span>
                            </div>
                            
                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <div className="text-right">
                                <div className={cn(
                                  'text-xs font-semibold',
                                  isTaskOverdue(task) && !task.completed ? 'text-red-600' : 'text-foreground'
                                )}>
                                  {formatDueDate(task.dueDate, 'MMM d')}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatDueDate(task.dueDate, 'h:mm a')}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                                  className="rounded-lg border border-border p-1.5 hover:bg-accent transition-colors"
                                  title="Edit task"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {role === 'master' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(task.id); }}
                                    className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete task"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {confirmDeleteId === task.id && (
                              <div className="col-span-12 flex items-center justify-end gap-2 py-2 bg-red-50 dark:bg-red-900/20 -mx-5 px-5">
                                <span className="text-xs font-bold text-red-600">Delete this task?</span>
                                <button onClick={() => deleteTask(task.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">
                                  Yes, Delete
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-accent">
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="border-t border-border bg-muted/30 px-5 py-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-foreground">{campaignTasks.length} total tasks</span>
                          <span className="text-green-600 font-bold">{completedCount} completed</span>
                          <span className="text-amber-600 font-bold">{campaignTasks.length - completedCount} pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Progress:</span>
                          <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-gc-orange transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="font-bold text-gc-orange">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', color)}>{value}</p>
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input className="settings-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select className="settings-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
