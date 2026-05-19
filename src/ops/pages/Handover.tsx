import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight, CheckCircle2, ClipboardList, Edit2, Handshake, Plus,
  RefreshCw, Search, ShieldAlert, Trash2, X, Users, ChevronDown, Calendar,
  Clock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../App';
import { canEditHandoverRecord, filterHandoversByRole, filterTasksByRole, filterTeamOptionsByRole, getWorkspaceScope } from '../lib/workspace';
import { getDefaultPlatformUserNames, loadPlatformUserNames, sortUniqueUserNames } from '../lib/platformUsers';
import { clearRecordParam } from '../lib/recordNavigation';
import { getTaskRecordPath } from '../lib/taskRoutes';
import { cn } from '../utils';
import { dataService } from '../services/dataService';
import { notify } from '../services/notificationService';
import { Handover, Task } from '../types';
import { Link, useSearchParams } from 'react-router-dom';

const SHIFT_OPTIONS: Handover['fromShift'][] = ['Morning', 'Mid', 'Night'];
const TEAM_OPTIONS = ['Operations', 'Coverage', 'Community', 'QA', 'Finance', 'Master Admin'];
const REGION_OPTIONS = ['KSA', 'UAE', 'Egypt', 'Kuwait', 'KSA / UAE', 'Regional', 'Global'];

const emptyDraft = (owners: string[], defaultTeam: string): Partial<Handover> => ({
  handoffDate: format(new Date(), 'yyyy-MM-dd'),
  fromShift: 'Morning', toShift: 'Mid', team: defaultTeam, region: 'Regional',
  notes: '', taskIds: [], status: 'Pending',
  assignFrom: [], assignTo: [],
});

function MultiSelectDropdown({ 
  label, selected, options, onChange, placeholder, disabled = false
}: { 
  label: string; 
  selected: string[]; 
  options: string[]; 
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (value: string) => {
    const isSelected = selected.includes(value);
    if (isSelected) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "settings-input flex h-10 w-full items-center justify-between px-3 py-2 text-left",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        disabled={disabled}
      >
        <span className={cn(selected.length === 0 && "text-muted-foreground")}>
          {selected.length === 0 ? (placeholder || "Select...") : `${selected.length} team members selected`}
        </span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-72 overflow-auto">
          <div className="sticky top-0 border-b border-border bg-muted/50 px-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="settings-input w-full pl-8 py-1 text-sm"
                placeholder="Search team members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="py-1">
            {filteredOptions.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                onClick={(e) => e.preventDefault()}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="h-4 w-4 accent-gc-orange"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                No members found
              </div>
            )}
          </div>
          <div className="sticky bottom-0 border-t border-border bg-muted/50 px-3 py-2 flex justify-between items-center">
            <button
              onClick={() => onChange([])}
              className="text-xs hover:text-destructive transition-colors"
              disabled={selected.length === 0}
            >
              Clear all
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded bg-gc-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-gc-orange/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HandoverCenter() {
  const { role, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const directHandoverId = searchParams.get('handover');
  const personFilter = searchParams.get('person') || '';
  const scope = getWorkspaceScope(role);
  
  const [handovers, setHandovers] = useState<Handover[]>(
    filterHandoversByRole(role, dataService.getHandovers())
  );
  const [tasks, setTasks] = useState<Task[]>(filterTasksByRole(role, dataService.getTasks()));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Handover['status']>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusedHandoverId, setFocusedHandoverId] = useState<string | null>(directHandoverId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<string[]>(getDefaultPlatformUserNames());

  useEffect(() => {
    let mounted = true;
    loadPlatformUserNames().then(users => {
      if (mounted) setAdminUsers(users);
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    return dataService.subscribeToWorkspaceChanges(() => {
      setHandovers(filterHandoversByRole(role, dataService.getHandovers()));
      setTasks(filterTasksByRole(role, dataService.getTasks()));
    }, ['handovers', 'tasks']);
  }, [role]);

  const owners = useMemo(() => {
    return sortUniqueUserNames([...adminUsers, user?.displayName]);
  }, [adminUsers, user?.displayName]);

  const teamOptions = useMemo(() => filterTeamOptionsByRole(role, TEAM_OPTIONS), [role]);
  const defaultTeam = teamOptions[0] || (scope === 'community' ? 'Community' : 'Operations');
  const [draft, setDraft] = useState<Partial<Handover>>(() => emptyDraft(owners, defaultTeam));
  
  useEffect(() => {
    if (!editingId) {
      setDraft(prev => ({
        ...prev,
        assignFrom: prev.assignFrom || [],
        assignTo: prev.assignTo || [],
      }));
    }
  }, [editingId]);

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  
  const linkedTasks = useMemo(() => {
    const selected = new Set(draft.taskIds || []);
    return tasks.filter((task) => selected.has(task.id));
  }, [draft.taskIds, tasks]);

  const readiness = useMemo(() => {
    let score = 0;
    if ((draft.assignFrom || []).length > 0) score += 25;
    if ((draft.assignTo || []).length > 0) score += 25;
    if (draft.team?.trim()) score += 10;
    if (draft.region?.trim()) score += 10;
    if (draft.notes?.trim()) score += 15;
    if (linkedTasks.length > 0) score += 15;
    return score;
  }, [draft, linkedTasks.length]);

  const canSaveHandover = (draft.assignFrom || []).length > 0 || (draft.assignTo || []).length > 0;
  const selectedTaskIds = useMemo(() => new Set(draft.taskIds || []), [draft.taskIds]);
  
  const availableTransferTasks = useMemo(() => {
    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return activeTasks
      .filter((task) => !selectedTaskIds.has(task.id))
      .sort((a, b) => 
        priorityWeight[b.priority] - priorityWeight[a.priority] || a.dueDate - b.dueDate
      );
  }, [activeTasks, selectedTaskIds]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter((handover) => {
      const haystack = [
        ...(handover.assignFrom || []), ...(handover.assignTo || []),
        handover.team, handover.region, handover.notes
      ].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesPerson = !personFilter || haystack.includes(personFilter.toLowerCase());
      const matchesStatus = statusFilter === 'all' || handover.status === statusFilter;
      return matchesQuery && matchesPerson && matchesStatus;
    });
  }, [handovers, personFilter, query, statusFilter]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(emptyDraft(owners, defaultTeam));
    setFocusedHandoverId(null);
    if (directHandoverId) setSearchParams(clearRecordParam(searchParams, 'handover'), { replace: true });
  };
  const canEditHandover = (handover: Handover) => canEditHandoverRecord(role, user?.displayName, handover);
  const canDeleteHandover = role === 'master';

  const saveHandover = () => {
    if (!canSaveHandover) {
      notify('Validation Failed', 'At least one Assign From or Assign To required', 'red', '/handover');
      return;
    }
    if (editingId) {
      const existingHandover = handovers.find(handover => handover.id === editingId);
      if (!existingHandover || !canEditHandover(existingHandover)) {
        notify('View Only', 'Only handover participants or Master can edit this handover.', 'orange', '/handover');
        resetDraft();
        return;
      }
      setHandovers(filterHandoversByRole(role, dataService.updateHandover(editingId, { ...draft, taskIds: draft.taskIds || [] })));
      notify('Handover Updated', `${draft.team} relay updated for ${(draft.assignTo || []).length} users`, 'orange', `/handover?handover=${encodeURIComponent(editingId)}`);
    } else {
      const next: Handover = {
        id: `HO-${Date.now()}`, handoffDate: draft.handoffDate || format(new Date(), 'yyyy-MM-dd'),
        fromShift: draft.fromShift || 'Morning', toShift: draft.toShift || 'Mid',
        team: draft.team || defaultTeam, region: draft.region || 'Regional',
        outgoingLead: (draft.assignFrom || [])[0] || '',
        incomingLead: (draft.assignTo || [])[0] || '',
        assignFrom: draft.assignFrom || [], assignTo: draft.assignTo || [],
        notes: draft.notes || '', taskIds: draft.taskIds || [], status: 'Pending',
        createdAt: Date.now(), updatedAt: Date.now(), createdBy: user?.displayName || 'Workspace User',
      };
      setHandovers(filterHandoversByRole(role, dataService.addHandover(next)));
      notify('Handover Created', `${next.fromShift} → ${next.toShift} relay for ${(next.assignTo || []).length} users`, 'green', `/handover?handover=${encodeURIComponent(next.id)}`);
    }
    resetDraft();
  };

  const startEdit = (handover: Handover) => {
    if (!canEditHandover(handover)) {
      notify('View Only', 'Only handover participants or Master can edit this handover.', 'orange', '/handover');
      return;
    }
    setEditingId(handover.id);
    setFocusedHandoverId(handover.id);
    const next = new URLSearchParams(searchParams);
    next.set('handover', handover.id);
    setSearchParams(next);
    setDraft({ ...handover });
  };

  useEffect(() => {
    if (!directHandoverId || editingId === directHandoverId) return;
    const handover = handovers.find((item) => item.id === directHandoverId);
    if (!handover) return;
    setFocusedHandoverId(handover.id);
    if (canEditHandoverRecord(role, user?.displayName, handover)) {
      setEditingId(handover.id);
      setDraft({ ...handover });
    }
  }, [directHandoverId, editingId, handovers, role, user?.displayName]);

  const toggleTask = (taskId: string) => {
    const selected = new Set(draft.taskIds || []);
    if (selected.has(taskId)) selected.delete(taskId); else selected.add(taskId);
    setDraft({ ...draft, taskIds: Array.from(selected) });
  };

  const acknowledge = (handover: Handover) => {
    if (!canEditHandover(handover)) {
      notify('View Only', 'Only handover participants or Master can update this handover.', 'orange', '/handover');
      return;
    }
    const nextStatus = handover.status === 'Pending' ? 'Acknowledged' : 'Reviewed';
    setHandovers(filterHandoversByRole(role, dataService.updateHandover(handover.id, {
      status: nextStatus, updatedAt: Date.now(),
      acknowledgedAt: nextStatus === 'Acknowledged' ? Date.now() : handover.acknowledgedAt,
      reviewedAt: nextStatus === 'Reviewed' ? Date.now() : handover.reviewedAt,
    })));
    notify('Handover Progressed', `${handover.team} handover marked ${nextStatus.toLowerCase()}`, 'green', `/handover?handover=${encodeURIComponent(handover.id)}`);
  };

  const removeHandover = (handover: Handover) => {
    if (!canDeleteHandover) {
      notify('Master Only', 'Only Master can delete handovers.', 'red', '/handover');
      return;
    }
    setHandovers(filterHandoversByRole(role, dataService.deleteHandover(handover.id)));
    notify('Handover Deleted', `${handover.team} relay removed`, 'red', '/handover');
    setConfirmDeleteId(null);
  };

  const pendingCount = handovers.filter((h) => h.status === 'Pending').length;
  const acknowledgedCount = handovers.filter((h) => h.status === 'Acknowledged').length;
  const transferredTaskCount = handovers.reduce((total, handover) => {
    const validTaskCount = tasks.filter(t => handover.taskIds.includes(t.id)).length;
    return total + validTaskCount;
  }, 0);

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Shift Continuity</div>
          <h2 className="font-extrabold text-2xl tracking-tight text-foreground">Handover Command</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Handshake size={16} className="text-gc-orange" />
            {personFilter ? `Handovers involving ${personFilter}` : 'Multi-assign tasks between team members with full context transfer'}
          </p>
        </div>
        <button onClick={resetDraft} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">
          <Plus size={16} /> New Handover
        </button>
      </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={pendingCount} tone="orange" />
        <StatCard label="Acknowledged" value={acknowledgedCount} tone="green" />
        <StatCard label="Tasks in Relay" value={transferredTaskCount} tone="purple" />
        <StatCard label="Readiness" value={readiness} suffix="%" tone={readiness >= 80 ? 'green' : readiness >= 50 ? 'orange' : 'red'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">Builder</p>
              <h3 className="text-lg font-bold text-foreground">{editingId ? 'Edit active relay' : 'Prepare next-shift relay'}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetDraft} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Reset</button>
              <button onClick={saveHandover} disabled={!canSaveHandover}
                className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90 disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw size={15} /> {editingId ? 'Update Handover' : 'Save Handover'}
              </button>
            </div>
          </div>
          
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <SelectField label="Date" value={draft.handoffDate || ''} onChange={(v) => setDraft({ ...draft, handoffDate: v })} type="date" />
            <SelectField label="Team" value={draft.team || defaultTeam} onChange={(v) => setDraft({ ...draft, team: v })} options={teamOptions} />
            <SelectField label="Region" value={draft.region || 'Regional'} onChange={(v) => setDraft({ ...draft, region: v })} options={REGION_OPTIONS} />
            
            <MultiSelectDropdown
              label="Assign From"
              selected={draft.assignFrom || []}
              onChange={(values) => setDraft({ ...draft, assignFrom: values })}
              options={owners}
              placeholder="Select source team members..."
            />
            
            <SelectField label="From Shift" value={draft.fromShift || 'Morning'} onChange={(v) => setDraft({ ...draft, fromShift: v as Handover['fromShift'] })} options={SHIFT_OPTIONS} />
            
            <MultiSelectDropdown
              label="Assign To"
              selected={draft.assignTo || []}
              onChange={(values) => setDraft({ ...draft, assignTo: values })}
              options={owners}
              placeholder="Select receiving team members..."
            />
            
            <SelectField label="To Shift" value={draft.toShift || 'Mid'} onChange={(v) => setDraft({ ...draft, toShift: v as Handover['toShift'] })} options={SHIFT_OPTIONS} />
            
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-900/30 dark:bg-orange-900/10 md:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gc-orange">Relay Summary</p>
              <div className="mt-2 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-red-600" />
                  <span className="font-semibold text-red-600">{(draft.assignFrom || []).length} source</span>
                </div>
                <ArrowRight size={16} className="text-gc-orange" />
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-green-600" />
                  <span className="font-semibold text-green-600">{(draft.assignTo || []).length} recipients</span>
                </div>
                <div className="ml-auto">
                  <span className="text-sm font-bold text-muted-foreground">{linkedTasks.length} linked tasks</span>
                </div>
              </div>
            </div>
            
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Shift Notes & Context</span>
              <textarea className="settings-input min-h-28" value={draft.notes || ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="Critical blockers, watchouts, due actions, and essential context for receiving team..."
              />
            </label>
          </div>
          
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Transfer Tasks</p>
                <p className="text-xs text-muted-foreground">Link active tasks to this handover</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                  {linkedTasks.length} linked
                </span>
                {role === 'master' && (
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-[11px] font-bold text-purple-700">
                    Master Admin
                  </span>
                )}
              </div>
            </div>
            
            {activeTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                <ClipboardList size={32} className="mx-auto mb-3 text-gc-orange/60" />
                <p>No active tasks available to transfer</p>
                <p className="text-xs mt-1">Complete or create tasks first</p>
              </div>
            ) : (
              <div className="space-y-3">
                <select className="settings-input" value="" onChange={(e) => {
                  if (!e.target.value) return;
                  toggleTask(e.target.value);
                }}>
                  <option value="">Search and add task...</option>
                  {availableTransferTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.priority} - {task.title} - {task.ownerId} - due {format(new Date(task.dueDate), 'MMM dd, h:mm a')}
                    </option>
                  ))}
                </select>
                
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                  {linkedTasks.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No tasks linked yet. Use the dropdown above to add tasks.
                    </div>
                  ) : (
                    linkedTasks.map((task) => {
                      const overdue = !task.completed && new Date(task.dueDate) < new Date();
                      return (
                        <div key={task.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/30">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{task.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {task.ownerId} • {task.campaignId || 'No campaign'} • due {format(new Date(task.dueDate), 'MMM dd, h:mm a')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                              task.priority === 'Critical' ? 'bg-red-50 text-red-700' :
                              task.priority === 'High' ? 'bg-orange-50 text-orange-700' :
                              task.priority === 'Medium' ? 'bg-amber-50 text-amber-700' :
                              'bg-green-50 text-green-700'
                            )}>
                              {task.priority}
                            </span>
                            {overdue && <AlertTriangle size={14} className="text-red-600" />}
                            <button onClick={() => toggleTask(task.id)} className="icon-btn text-destructive hover:bg-destructive/10">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gc-orange">Health Check</p>
              <h3 className="text-lg font-bold text-foreground">Readiness Pulse</h3>
            </div>
            <div className="space-y-4 p-5">
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={cn('h-full rounded-full transition-all duration-500',
                  readiness >= 80 ? 'bg-green-500' : readiness >= 50 ? 'bg-gc-orange' : 'bg-red-500'
                )} style={{ width: `${readiness}%` }} />
              </div>
              <div className="grid gap-2">
                <ReadinessItem ok={(draft.assignFrom || []).length > 0} label="Source team selected" />
                <ReadinessItem ok={(draft.assignTo || []).length > 0} label="Receiving team selected" />
                <ReadinessItem ok={linkedTasks.length > 0} label="Tasks linked for transfer" />
                <ReadinessItem ok={Boolean(draft.notes?.trim())} label="Shift notes captured" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="grid gap-3 border-b border-border bg-muted/30 p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input className="settings-input pl-9" placeholder="Search leads, teams, regions..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="settings-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Reviewed">Reviewed</option>
              </select>
            </div>
            
            <div className="max-h-[760px] overflow-y-auto">
              {filteredHandovers.map((handover) => {
                const relatedTasks = tasks.filter((t) => handover.taskIds.includes(t.id));
                const hasEditAccess = canEditHandover(handover);
                
                return (
                  <div
                    key={handover.id}
                    className={cn(
                      'border-b border-border p-5 transition-colors last:border-b-0 hover:bg-muted/20',
                      focusedHandoverId === handover.id && 'bg-gc-orange/5 ring-2 ring-inset ring-gc-orange/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(handover)}
                            className="text-left text-sm font-bold text-foreground hover:text-gc-orange"
                          >
                            {handover.team}
                          </button>
                          <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase',
                            handover.status === 'Reviewed' ? 'bg-green-50 text-green-700' :
                            handover.status === 'Acknowledged' ? 'bg-purple-50 text-purple-700' :
                            'bg-orange-50 text-orange-700'
                          )}>
                            {handover.status}
                          </span>
                          {(handover.assignFrom && handover.assignFrom.length > 0) && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                              {(handover.assignFrom || []).length} sources
                            </span>
                          )}
                          {(handover.assignTo && handover.assignTo.length > 0) && (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                              {(handover.assignTo || []).length} recipients
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ArrowRight size={12} className="text-gc-orange" />
                            <span>{handover.region}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{handover.fromShift} → {handover.toShift}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{handover.handoffDate}</span>
                          </div>
                        </div>
                        
                        {(handover.assignFrom || handover.assignTo) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {handover.assignFrom && handover.assignFrom.length > 0 && (
                              <div className="flex items-center gap-1 rounded bg-red-50 px-2 py-1">
                                <span className="font-bold text-red-700">From:</span>
                                <span className="text-red-600">{handover.assignFrom.join(', ')}</span>
                              </div>
                            )}
                            {handover.assignTo && handover.assignTo.length > 0 && (
                              <div className="flex items-center gap-1 rounded bg-green-50 px-2 py-1">
                                <span className="font-bold text-green-700">To:</span>
                                <span className="text-green-600">{handover.assignTo.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right min-w-[100px]">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-bold text-foreground">{relatedTasks.length}</span>
                          <span className="text-[10px] text-muted-foreground">tasks</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(handover.createdAt), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                    
                    <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground leading-relaxed">
                      {handover.notes || 'No shift notes recorded.'}
                    </p>
                    
                    {relatedTasks.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {relatedTasks.slice(0, 4).map((task) => (
                            <Link key={task.id} to={getTaskRecordPath(task.id)} className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground hover:border-gc-orange hover:text-gc-orange">
                              {task.title}
                            </Link>
                          ))}
                          {relatedTasks.length > 4 && (
                            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                              +{relatedTasks.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 flex items-center justify-end gap-2">
                      {confirmDeleteId === handover.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-destructive">Delete?</span>
                          <button onClick={() => removeHandover(handover)} 
                            className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white hover:bg-destructive/90">
                            Yes
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} 
                            className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-accent">
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {hasEditAccess && handover.status !== 'Reviewed' && (
                            <button onClick={() => acknowledge(handover)} 
                              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">
                              <CheckCircle2 size={13} />
                              {handover.status === 'Pending' ? 'Acknowledge' : 'Mark Reviewed'}
                            </button>
                          )}
                          {hasEditAccess && (
                            <button onClick={() => startEdit(handover)} 
                              className="rounded-lg border border-border p-2 hover:bg-accent">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {canDeleteHandover && (
                            <button onClick={() => setConfirmDeleteId(handover.id)} 
                              className="rounded-lg border border-red-200 p-2 text-destructive hover:bg-destructive/10">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredHandovers.length === 0 && (
                <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                  <ClipboardList size={48} className="text-gc-orange/60" />
                  <p className="text-sm font-semibold">No handovers match your search</p>
                  <p className="text-xs">Try adjusting your filters or search terms</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label, value, onChange, options = [], type = 'select'
}: { label: string; value: string; onChange: (v: string) => void; options?: string[]; type?: 'select' | 'date' }) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {type === 'date' ? (
        <input className="settings-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <select className="settings-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )}
    </label>
  );
}

function ReadinessItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-2',
      ok ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10')}> 
      <div className={cn('flex h-6 w-6 items-center justify-center rounded-full',
        ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white')}> 
        {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      </div>
      <span className={cn('text-sm font-semibold', ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
        {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, suffix = '', tone }: { 
  label: string; 
  value: number; 
  suffix?: string; 
  tone: 'orange' | 'green' | 'purple' | 'red';
}) {
  const colors = {
    orange: 'text-gc-orange',
    green: 'text-green-600',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', colors[tone])}>{value}{suffix}</p>
    </div>
  );
}
