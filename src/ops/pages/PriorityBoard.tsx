import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowUpCircle, BellRing, CheckCircle2, Circle,
  Clock, Edit2, Flag, FolderKanban, Layers3, Plus, RefreshCw,
  Save, Search, Trash2, X, LayoutGrid, Check, ChevronDown, ChevronUp,
  User, Calendar, MapPin, DollarSign, Target, List, Grid3x3, Columns
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

const DEFAULT_DAILY_TASKS = [
  { area: 'Coordination', task: 'Monitor client groups, assign tasks, follow up on blockers, run handovers.' },
  { area: 'WhatsApp / Live Chat', task: 'Reply fast, handle confirmations, reminders, visits, complaints, and missed visits.' },
  { area: 'Coverage', task: 'Check coverage 4 times daily, follow up on missing posts, archive proofs.' },
  { area: 'Onboarding', task: 'Add new influencers, complete profiles, update data, prepare lookalike lists.' },
  { area: 'Activation', task: 'Contact inactive/new influencers and build backup influencer pool.' },
  { area: 'Quality', task: 'Audit chats, coverage, onboarding, mistakes, and train agents.' },
  { area: 'Systems', task: 'Maintain dashboards, automations, reminders, and live reports.' },
  { area: 'Account Managers', task: 'Track client targets, campaign progress, risks, and client updates.' },
  { area: 'Data Analysis', task: 'Validate influencer data and prepare clean usable lists.' },
];

const DEFAULT_CAMPAIGN_STAGES = [
  { stage: 'Campaign Setup', tasks: 'Review booking, target, dates, branches, deliverables, criteria, and exceptions.' },
  { stage: 'Data Preparation', tasks: 'Filter active, inactive, blocked influencers, and WhatsApp active numbers.' },
  { stage: 'Influencer Pool', tasks: 'Prepare main list, lookalike list, and backup list.' },
  { stage: 'Client Validation', tasks: 'Confirm QR/test codes, booking details, and emergency contact.' },
  { stage: 'Task Assignment', tasks: 'Split work by team and assign clear owners.' },
  { stage: 'Outreach', tasks: 'Send invitations, reminders, answer questions, and collect confirmations.' },
  { stage: 'Visit Management', tasks: 'Confirm visit dates, follow up before visits, and reschedule missed visits.' },
  { stage: 'Coverage Monitoring', tasks: 'Track posts, missing coverage, overdue posts, and content compliance.' },
  { stage: 'Quality Check', tasks: 'Audit communication, coverage, data, and mistakes.' },
  { stage: 'Reporting', tasks: 'Update live report, share client updates, and prepare final campaign report.' },
  { stage: 'Closure', tasks: 'Archive all proofs, close missing items, document learnings, and send final report.' },
];

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

type ViewLayout = 'list' | 'grid' | 'compact';

interface DailyTaskTemplate {
  id: string;
  area: string;
  task: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: number;
  priority?: Task['priority'];
  expanded?: boolean;
}

interface CampaignStageTemplate {
  id: string;
  stage: string;
  tasks: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: number;
  priority?: Task['priority'];
  expanded?: boolean;
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
  const [viewLayout, setViewLayout] = useState<ViewLayout>('list');
  
  // Daily task templates
  const [dailyTaskTemplates, setDailyTaskTemplates] = useState<DailyTaskTemplate[]>(() => {
    const stored = localStorage.getItem('GC_DAILY_TASK_TEMPLATES');
    if (stored) return JSON.parse(stored);
    return DEFAULT_DAILY_TASKS.map((t, i) => ({ id: `DT-${i}`, ...t, completed: false }));
  });
  
  // Campaign stage templates
  const [campaignStageTemplates, setCampaignStageTemplates] = useState<CampaignStageTemplate[]>(() => {
    const stored = localStorage.getItem('GC_CAMPAIGN_STAGE_TEMPLATES');
    if (stored) return JSON.parse(stored);
    return DEFAULT_CAMPAIGN_STAGES.map((s, i) => ({ id: `CS-${i}`, ...s, completed: false }));
  });
  
  const [editingDailyTask, setEditingDailyTask] = useState<string | null>(null);
  const [editingCampaignStage, setEditingCampaignStage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('GC_DAILY_TASK_TEMPLATES', JSON.stringify(dailyTaskTemplates));
  }, [dailyTaskTemplates]);
  
  useEffect(() => {
    localStorage.setItem('GC_CAMPAIGN_STAGE_TEMPLATES', JSON.stringify(campaignStageTemplates));
  }, [campaignStageTemplates]);

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

  const dailyTasks = useMemo(() => {
    return filteredTasks.filter((t) => !t.campaignId || t.campaignId.trim() === '');
  }, [filteredTasks]);

  const tasksByCampaign = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      const key = t.campaignId?.trim();
      if (!key) return; // Skip tasks without campaign (they go to daily)
      if (key === 'Account Managers') return;
      
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks]);

  const totalActive = tasks.filter((t) => !t.completed).length;
  const totalOverdue = tasks.filter(isTaskOverdue).length;
  const criticalCount = tasks.filter((t) => t.priority === 'Critical' && !t.completed).length;
  const dailyActiveCount = dailyTasks.filter((t) => !t.completed).length;

  const openCreate = (campaignId?: string) => { 
    setDraft({ ...emptyDraft(), campaignId: campaignId || '' }); 
    setShowCreate(true); 
  };

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const saveCampaignEdit = () => {
    if (!editingCampaign) return;
    setCampaigns(dataService.updateCampaign(editingCampaign.id, editingCampaign));
    notify('Campaign Updated', `"${editingCampaign.name}" details saved`, 'orange', '/priority-board');
    setEditingCampaign(null);
  };

  const deleteCampaign = (id: string) => {
    setCampaigns(dataService.deleteCampaign(id));
    notify('Campaign Removed', 'Campaign bucket deleted successfully', 'red', '/priority-board');
  };

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

  const toggleDailyTaskComplete = (id: string) => {
    setDailyTaskTemplates(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };
  
  const toggleCampaignStageComplete = (id: string) => {
    setCampaignStageTemplates(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };
  
  const addDailyTask = () => {
    const newTask: DailyTaskTemplate = {
      id: `DT-${Date.now()}`,
      area: 'New Area',
      task: 'New task description',
      completed: false,
      assignedTo: '',
      dueDate: Date.now() + ONE_DAY,
      priority: 'Medium',
      expanded: false,
    };
    setDailyTaskTemplates(prev => [...prev, newTask]);
  };
  
  const addCampaignStage = () => {
    const newStage: CampaignStageTemplate = {
      id: `CS-${Date.now()}`,
      stage: 'New Stage',
      tasks: 'Stage tasks description',
      completed: false,
      assignedTo: '',
      dueDate: Date.now() + ONE_DAY,
      priority: 'Medium',
      expanded: false,
    };
    setCampaignStageTemplates(prev => [...prev, newStage]);
  };
  
  const updateDailyTask = (id: string, updates: Partial<DailyTaskTemplate>) => {
    setDailyTaskTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const updateCampaignStage = (id: string, updates: Partial<CampaignStageTemplate>) => {
    setCampaignStageTemplates(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const deleteDailyTask = (id: string) => {
    setDailyTaskTemplates(prev => prev.filter(t => t.id !== id));
  };
  
  const deleteCampaignStage = (id: string) => {
    setCampaignStageTemplates(prev => prev.filter(s => s.id !== id));
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
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewLayout('list')}
              className={cn('p-1.5 rounded transition-colors', viewLayout === 'list' ? 'bg-gc-orange text-white' : 'hover:bg-accent')}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewLayout('grid')}
              className={cn('p-1.5 rounded transition-colors', viewLayout === 'grid' ? 'bg-gc-orange text-white' : 'hover:bg-accent')}
              title="Grid view"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setViewLayout('compact')}
              className={cn('p-1.5 rounded transition-colors', viewLayout === 'compact' ? 'bg-gc-orange text-white' : 'hover:bg-accent')}
              title="Compact view"
            >
              <Columns size={16} />
            </button>
          </div>
          <button onClick={() => openCreate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gc-orange px-3 text-xs font-bold text-white hover:bg-gc-orange/90">
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Daily Tasks" value={dailyActiveCount} color="text-blue-600 dark:text-blue-400" />
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
              <h3 className="text-lg font-bold text-foreground">Create Task {draft.campaignId ? `for ${draft.campaignId}` : ''}</h3>
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

      {editingCampaign && (
        <div className="rounded-xl border border-blue-200 bg-card p-5 shadow-sm dark:border-blue-900/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-blue-600">Modify Campaign</p>
              <h3 className="text-lg font-bold text-foreground">Edit {editingCampaign.name}</h3>
            </div>
            <button onClick={() => setEditingCampaign(null)} className="icon-btn"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldInput label="Campaign Name" value={editingCampaign.name} onChange={(v) => setEditingCampaign({ ...editingCampaign, name: v })} />
            <SelectField label="Status" value={editingCampaign.status} onChange={(v) => setEditingCampaign({ ...editingCampaign, status: v as any })} options={['Active', 'Blocked', 'Closed', 'On Hold']} />
            <FieldInput label="City" value={editingCampaign.city} onChange={(v) => setEditingCampaign({ ...editingCampaign, city: v })} />
            <FieldInput label="Country" value={editingCampaign.country} onChange={(v) => setEditingCampaign({ ...editingCampaign, country: v })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditingCampaign(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
            <button onClick={saveCampaignEdit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Save size={15} /> Save Changes</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Daily Recurring Tasks Section */}
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-card shadow-lg overflow-hidden dark:border-blue-900/30">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Clock size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">Daily Tasks</h3>
                  <p className="text-xs text-blue-100">Recurring tasks to complete today</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{dailyTaskTemplates.filter(t => t.completed).length}/{dailyTaskTemplates.length}</div>
                  <div className="text-[10px] font-bold uppercase text-blue-100">Completed</div>
                </div>
                <button
                  onClick={addDailyTask}
                  className="p-2.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                  title="Add daily task"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          {dailyTaskTemplates.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Clock size={40} className="mx-auto mb-3 text-blue-400/50" />
              <p className="text-sm font-semibold text-muted-foreground">No daily tasks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add recurring tasks that need to be done every day</p>
            </div>
          ) : (
            <div className={cn(
              viewLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3 p-4' :
              viewLayout === 'compact' ? 'divide-y divide-blue-100 dark:divide-blue-900/30' :
              'divide-y divide-blue-100 dark:divide-blue-900/30'
            )}>
              {dailyTaskTemplates.map((taskTemplate) => {
                const isEditing = editingDailyTask === taskTemplate.id;
                const isExpanded = taskTemplate.expanded;
                
                if (isEditing) {
                  return (
                    <div key={taskTemplate.id} className={cn(
                      'bg-orange-50/40 dark:bg-orange-900/10',
                      viewLayout === 'grid' ? 'p-4 rounded-lg border border-orange-200 dark:border-orange-900/30' : 'px-6 py-4'
                    )}>
                      <div className="space-y-3">
                        <input
                          className="settings-input text-sm font-bold"
                          value={taskTemplate.area}
                          onChange={(e) => updateDailyTask(taskTemplate.id, { area: e.target.value })}
                          placeholder="Area name"
                        />
                        <textarea
                          className="settings-input text-xs"
                          value={taskTemplate.task}
                          onChange={(e) => updateDailyTask(taskTemplate.id, { task: e.target.value })}
                          placeholder="Task description"
                          rows={3}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            className="settings-input text-xs"
                            value={taskTemplate.assignedTo || ''}
                            onChange={(e) => updateDailyTask(taskTemplate.id, { assignedTo: e.target.value })}
                          >
                            <option value="">Assign to...</option>
                            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            className="settings-input text-xs"
                            value={taskTemplate.priority || 'Medium'}
                            onChange={(e) => updateDailyTask(taskTemplate.id, { priority: e.target.value as Task['priority'] })}
                          >
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <input
                          className="settings-input text-xs"
                          type="date"
                          value={taskTemplate.dueDate ? formatDueDate(taskTemplate.dueDate, 'yyyy-MM-dd') : ''}
                          onChange={(e) => updateDailyTask(taskTemplate.id, { dueDate: parseDateInput(e.target.value, taskTemplate.dueDate) })}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingDailyTask(null)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                            <Save size={12} className="inline mr-1" /> Done
                          </button>
                          {role === 'master' && (
                            <button onClick={() => { deleteDailyTask(taskTemplate.id); setEditingDailyTask(null); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                              <Trash2 size={12} className="inline mr-1" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                if (viewLayout === 'grid') {
                  return (
                    <div key={taskTemplate.id} className="space-y-2">
                      <div
                        className={cn(
                          'p-4 rounded-lg border border-blue-200 dark:border-blue-900/30 transition-all hover:shadow-md cursor-pointer',
                          taskTemplate.completed && 'opacity-60 bg-blue-50/30 dark:bg-blue-900/5'
                        )}
                        onClick={() => updateDailyTask(taskTemplate.id, { expanded: !isExpanded })}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleDailyTaskComplete(taskTemplate.id); }}
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all flex-shrink-0 mt-0.5',
                              taskTemplate.completed
                                ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                : 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            )}
                          >
                            {taskTemplate.completed && <Check size={12} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className={cn(
                                'text-sm font-bold text-blue-600 dark:text-blue-400',
                                taskTemplate.completed && 'line-through opacity-60'
                              )}>
                                {taskTemplate.area}
                              </h4>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingDailyTask(taskTemplate.id); }}
                                  className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </div>
                            <p className={cn(
                              'text-xs text-muted-foreground',
                              taskTemplate.completed && 'line-through'
                            )}>
                              {taskTemplate.task}
                            </p>
                            {taskTemplate.assignedTo && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs">
                                <User size={11} className="text-muted-foreground" />
                                <span className="font-semibold">{taskTemplate.assignedTo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-900/30 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Assigned:</span>
                              <span className="ml-1 font-semibold">{taskTemplate.assignedTo || 'Unassigned'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Priority:</span>
                              <span className="ml-1 font-semibold">{taskTemplate.priority || 'Medium'}</span>
                            </div>
                            {taskTemplate.dueDate && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Due:</span>
                                <span className="ml-1 font-semibold">{formatDueDate(taskTemplate.dueDate, 'MMM d, yyyy')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                
                if (viewLayout === 'compact') {
                  return (
                    <div
                      key={taskTemplate.id}
                      className={cn(
                        'px-6 py-2.5 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 flex items-center gap-3',
                        taskTemplate.completed && 'opacity-60 bg-blue-50/30 dark:bg-blue-900/5'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDailyTaskComplete(taskTemplate.id)}
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all flex-shrink-0',
                          taskTemplate.completed
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        )}
                      >
                        {taskTemplate.completed && <Check size={10} />}
                      </button>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className={cn(
                          'text-xs font-bold text-blue-600 dark:text-blue-400 w-32 flex-shrink-0',
                          taskTemplate.completed && 'line-through opacity-60'
                        )}>
                          {taskTemplate.area}
                        </span>
                        <span className={cn(
                          'text-xs text-muted-foreground truncate',
                          taskTemplate.completed && 'line-through'
                        )}>
                          {taskTemplate.task}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingDailyTask(taskTemplate.id)}
                        className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex-shrink-0"
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={taskTemplate.id}
                    className={cn(
                      'px-6 py-4 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
                      taskTemplate.completed && 'opacity-60 bg-blue-50/30 dark:bg-blue-900/5'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => toggleDailyTaskComplete(taskTemplate.id)}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all flex-shrink-0',
                          taskTemplate.completed
                            ? 'border-green-500 bg-green-500 text-white shadow-sm'
                            : 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        )}
                      >
                        {taskTemplate.completed && <Check size={14} />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            'text-sm font-bold text-blue-600 dark:text-blue-400',
                            taskTemplate.completed && 'line-through opacity-60'
                          )}>
                            {taskTemplate.area}
                          </h4>
                        </div>
                        <p className={cn(
                          'mt-0.5 text-xs text-muted-foreground',
                          taskTemplate.completed && 'line-through'
                        )}>
                          {taskTemplate.task}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => setEditingDailyTask(taskTemplate.id)}
                        className="rounded-lg border border-border p-1.5 hover:bg-accent transition-colors flex-shrink-0"
                        title="Edit task"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaign Tasks Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <FolderKanban size={20} className="text-gc-orange" />
                Campaign Stage Checklist
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Standard stages for every campaign</p>
            </div>
            <button
              onClick={addCampaignStage}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gc-orange px-3 text-xs font-bold text-white hover:bg-gc-orange/90"
            >
              <Plus size={12} /> Add Stage
            </button>
          </div>

          <div className={cn(
            'rounded-xl border border-border bg-card overflow-hidden shadow-sm mb-6',
            viewLayout === 'grid' ? 'p-4' : ''
          )}>
            {campaignStageTemplates.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FolderKanban size={40} className="mx-auto mb-3 text-gc-orange/50" />
                <p className="text-sm font-semibold text-muted-foreground">No campaign stages yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add standard stages for campaign execution</p>
              </div>
            ) : (
              <div className={cn(
                viewLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' :
                viewLayout === 'compact' ? 'divide-y divide-border' :
                'divide-y divide-border'
              )}>
                {campaignStageTemplates.map((stageTemplate) => {
                  const isEditing = editingCampaignStage === stageTemplate.id;
                  
                  if (isEditing) {
                    return (
                      <div key={stageTemplate.id} className={cn(
                        'bg-orange-50/40 dark:bg-orange-900/10',
                        viewLayout === 'grid' ? 'p-4 rounded-lg border border-orange-200 dark:border-orange-900/30' : 'px-6 py-4'
                      )}>
                        <div className="space-y-3">
                          <input
                            className="settings-input text-sm font-bold"
                            value={stageTemplate.stage}
                            onChange={(e) => updateCampaignStage(stageTemplate.id, { stage: e.target.value })}
                            placeholder="Stage name"
                          />
                          <textarea
                            className="settings-input text-xs"
                            value={stageTemplate.tasks}
                            onChange={(e) => updateCampaignStage(stageTemplate.id, { tasks: e.target.value })}
                            placeholder="Stage tasks"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingCampaignStage(null)} className="rounded-lg bg-gc-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-gc-orange/90">
                              <Save size={12} className="inline mr-1" /> Done
                            </button>
                            {role === 'master' && (
                              <button onClick={() => { deleteCampaignStage(stageTemplate.id); setEditingCampaignStage(null); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                                <Trash2 size={12} className="inline mr-1" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  if (viewLayout === 'grid') {
                    return (
                      <div
                        key={stageTemplate.id}
                        className={cn(
                          'p-4 rounded-lg border border-border transition-all hover:shadow-md',
                          stageTemplate.completed && 'opacity-60 bg-muted/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleCampaignStageComplete(stageTemplate.id)}
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all flex-shrink-0 mt-0.5',
                              stageTemplate.completed
                                ? 'border-green-500 bg-green-500 text-white shadow-sm'
                                : 'border-gc-orange hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            )}
                          >
                            {stageTemplate.completed && <Check size={12} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className={cn(
                                'text-sm font-bold text-gc-orange',
                                stageTemplate.completed && 'line-through opacity-60'
                              )}>
                                {stageTemplate.stage}
                              </h4>
                              <button
                                onClick={() => setEditingCampaignStage(stageTemplate.id)}
                                className="p-1 rounded hover:bg-accent transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                            <p className={cn(
                              'text-xs text-muted-foreground',
                              stageTemplate.completed && 'line-through'
                            )}>
                              {stageTemplate.tasks}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  if (viewLayout === 'compact') {
                    return (
                      <div
                        key={stageTemplate.id}
                        className={cn(
                          'px-6 py-2.5 transition-colors hover:bg-muted/30 flex items-center gap-3',
                          stageTemplate.completed && 'opacity-60 bg-muted/20'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCampaignStageComplete(stageTemplate.id)}
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all flex-shrink-0',
                            stageTemplate.completed
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gc-orange hover:bg-orange-50 dark:hover:bg-orange-900/20'
                          )}
                        >
                          {stageTemplate.completed && <Check size={10} />}
                        </button>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <span className={cn(
                            'text-xs font-bold text-gc-orange w-40 flex-shrink-0',
                            stageTemplate.completed && 'line-through opacity-60'
                          )}>
                            {stageTemplate.stage}
                          </span>
                          <span className={cn(
                            'text-xs text-muted-foreground truncate',
                            stageTemplate.completed && 'line-through'
                          )}>
                            {stageTemplate.tasks}
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingCampaignStage(stageTemplate.id)}
                          className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={stageTemplate.id}
                      className={cn(
                        'px-6 py-4 transition-colors hover:bg-muted/30',
                        stageTemplate.completed && 'opacity-60 bg-muted/20'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => toggleCampaignStageComplete(stageTemplate.id)}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all flex-shrink-0',
                            stageTemplate.completed
                              ? 'border-green-500 bg-green-500 text-white shadow-sm'
                              : 'border-gc-orange hover:bg-orange-50 dark:hover:bg-orange-900/20'
                          )}
                        >
                          {stageTemplate.completed && <Check size={14} />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn(
                              'text-sm font-bold text-gc-orange',
                              stageTemplate.completed && 'line-through opacity-60'
                            )}>
                              {stageTemplate.stage}
                            </h4>
                          </div>
                          <p className={cn(
                            'mt-0.5 text-xs text-muted-foreground',
                            stageTemplate.completed && 'line-through'
                          )}>
                            {stageTemplate.tasks}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => setEditingCampaignStage(stageTemplate.id)}
                          className="rounded-lg border border-border p-1.5 hover:bg-accent transition-colors flex-shrink-0"
                          title="Edit stage"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Campaign-Specific Tasks Section */}
        <div>

          {tasksByCampaign.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border py-12 text-center">
              <FolderKanban size={48} className="mx-auto mb-4 text-gc-orange/50" />
              <h3 className="text-lg font-bold text-foreground">No Campaign Tasks</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create tasks or adjust your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasksByCampaign.map(([campaignName, campaignTasks]) => {
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
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openCreate(campaignName); }}
                        className="p-2 rounded-lg bg-gc-orange/10 text-gc-orange hover:bg-gc-orange/20 transition-colors"
                        title="Add task to this campaign"
                      >
                        <Plus size={16} />
                      </button>
                      {role === 'master' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign || null); }}
                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Edit campaign bucket"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if(campaign) deleteCampaign(campaign.id); }}
                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete campaign bucket"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
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
            })}
            </div>
          )}
        </div>
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
