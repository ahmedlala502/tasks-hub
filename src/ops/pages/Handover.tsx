import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Edit2,
  Handshake,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../App';
import { filterHandoversByRole, filterOwnerOptionsByRole, filterTasksByRole, filterTeamOptionsByRole, getWorkspaceScope } from '../lib/workspace';
import { cn } from '../utils';
import { dataService, TEAM_MEMBERS } from '../services/dataService';
import { notify } from '../services/notificationService';
import { Handover, Task } from '../types';

const SHIFT_OPTIONS: Handover['fromShift'][] = ['Morning', 'Mid', 'Night'];
const TEAM_OPTIONS = ['Operations', 'Coverage', 'Community', 'QA'];
const REGION_OPTIONS = ['KSA', 'UAE', 'Egypt', 'Kuwait', 'KSA / UAE', 'Regional'];

const emptyDraft = (owners: string[], defaultTeam: string): Partial<Handover> => ({
  handoffDate: format(new Date(), 'yyyy-MM-dd'),
  fromShift: 'Morning',
  toShift: 'Mid',
  team: defaultTeam,
  region: 'Regional',
  outgoingLead: owners[0] || '',
  incomingLead: owners[1] || owners[0] || '',
  notes: '',
  taskIds: [],
  status: 'Pending',
});

export default function HandoverCenter() {
  const { role } = useAuth();
  const scope = getWorkspaceScope(role);
  const [handovers, setHandovers] = useState<Handover[]>(filterHandoversByRole(role, dataService.getHandovers()));
  const [tasks, setTasks] = useState<Task[]>(filterTasksByRole(role, dataService.getTasks()));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Handover['status']>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [adminUsers, setAdminUsers] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    import('../services/adminApi').then(({ adminApi }) => {
      adminApi.listUsers().then(users => {
        if (mounted) {
          setAdminUsers(users.filter(u => u.status === 'active').map(u => u.displayName));
        }
      }).catch(console.error);
    });
    return () => { mounted = false; };
  }, []);

  const owners = useMemo(() => {
    const fromTasks = tasks.map((task) => task.ownerId.trim()).filter(Boolean);
    const combined = Array.from(new Set([...TEAM_MEMBERS, ...adminUsers, ...fromTasks]));
    return filterOwnerOptionsByRole(role, combined);
  }, [role, tasks, adminUsers]);

  const teamOptions = useMemo(() => filterTeamOptionsByRole(role, TEAM_OPTIONS), [role]);
  const defaultTeam = teamOptions[0] || (scope === 'community' ? 'Community' : 'Operations');

  const [draft, setDraft] = useState<Partial<Handover>>(() => emptyDraft(owners, defaultTeam));

  useEffect(() => {
    if (!editingId && (!draft.outgoingLead || !draft.incomingLead) && owners.length > 0) {
      setDraft(prev => ({
        ...prev,
        outgoingLead: prev.outgoingLead || owners[0] || '',
        incomingLead: prev.incomingLead || owners[1] || owners[0] || '',
      }));
    }
  }, [owners, editingId, draft.outgoingLead, draft.incomingLead]);

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);

  const linkedTasks = useMemo(() => {
    const selected = new Set(draft.taskIds || []);
    return tasks.filter((task) => selected.has(task.id));
  }, [draft.taskIds, tasks]);

  const readiness = useMemo(() => {
    let score = 0;
    if (draft.outgoingLead?.trim()) score += 20;
    if (draft.incomingLead?.trim()) score += 20;
    if (draft.team?.trim()) score += 10;
    if (draft.region?.trim()) score += 10;
    if (draft.notes?.trim()) score += 20;
    if (linkedTasks.length > 0) score += 20;
    return score;
  }, [draft, linkedTasks.length]);

  const canSaveHandover = Boolean(draft.outgoingLead?.trim() && draft.incomingLead?.trim());

  const selectedTaskIds = useMemo(() => new Set(draft.taskIds || []), [draft.taskIds]);
  const availableTransferTasks = useMemo(() => {
    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return activeTasks
      .filter((task) => !selectedTaskIds.has(task.id))
      .slice()
      .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.dueDate - b.dueDate);
  }, [activeTasks, selectedTaskIds]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter((handover) => {
      const haystack = `${handover.outgoingLead} ${handover.incomingLead} ${handover.team} ${handover.region} ${handover.notes}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || handover.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [handovers, query, statusFilter]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(emptyDraft(owners, defaultTeam));
  };

  const saveHandover = () => {
    if (!draft.outgoingLead?.trim() || !draft.incomingLead?.trim()) return;

    if (editingId) {
      setHandovers(filterHandoversByRole(role, dataService.updateHandover(editingId, { ...draft, taskIds: draft.taskIds || [] })));
      notify('Handover Updated', `${draft.team} relay updated for ${draft.incomingLead}`, 'orange', '/handover');
    } else {
      const next: Handover = {
        id: `HO-${Date.now()}`,
        handoffDate: draft.handoffDate || format(new Date(), 'yyyy-MM-dd'),
        fromShift: draft.fromShift || 'Morning',
        toShift: draft.toShift || 'Mid',
        team: draft.team || defaultTeam,
        region: draft.region || 'Regional',
        outgoingLead: draft.outgoingLead || '',
        incomingLead: draft.incomingLead || '',
        notes: draft.notes || '',
        taskIds: draft.taskIds || [],
        status: 'Pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
      };
      setHandovers(filterHandoversByRole(role, dataService.addHandover(next)));
      notify('Handover Created', `${next.fromShift} to ${next.toShift} relay sent to ${next.incomingLead}`, 'green', '/handover');
    }

    resetDraft();
  };

  const startEdit = (handover: Handover) => {
    setEditingId(handover.id);
    setDraft({ ...handover });
  };

  const toggleTask = (taskId: string) => {
    const selected = new Set(draft.taskIds || []);
    if (selected.has(taskId)) selected.delete(taskId);
    else selected.add(taskId);
    setDraft({ ...draft, taskIds: Array.from(selected) });
  };

  const acknowledge = (handover: Handover) => {
    const nextStatus = handover.status === 'Pending' ? 'Acknowledged' : 'Reviewed';
    setHandovers(filterHandoversByRole(role, dataService.updateHandover(handover.id, {
      status: nextStatus,
      acknowledgedAt: nextStatus === 'Acknowledged' ? Date.now() : handover.acknowledgedAt,
      reviewedAt: nextStatus === 'Reviewed' ? Date.now() : handover.reviewedAt,
    })));
    notify('Handover Progressed', `${handover.team} handover marked ${nextStatus.toLowerCase()}`, 'green', '/handover');
  };

  const removeHandover = (handover: Handover) => {
    setHandovers(filterHandoversByRole(role, dataService.deleteHandover(handover.id)));
    notify('Handover Deleted', `${handover.team} relay removed`, 'red', '/handover');
    setConfirmDeleteId(null);
  };

  const pendingCount = handovers.filter((handover) => handover.status === 'Pending').length;
  const acknowledgedCount = handovers.filter((handover) => handover.status === 'Acknowledged').length;
  const transferredTaskCount = handovers.reduce((total, handover) => {
    const validTaskCount = tasks.filter(t => handover.taskIds.includes(t.id)).length;
    return total + validTaskCount;
  }, 0);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Shift Continuity</div>
          <h2 className="font-extrabold text-2xl tracking-tight text-foreground">Handover Command</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Handshake size={16} className="text-gc-orange" />
            Carry risks, tasks, and priorities cleanly into the next shift without leaving Ops.
          </p>
        </div>
        <button
          onClick={resetDraft}
          className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90"
        >
          <Plus size={16} />
          New Handover
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
              <button
                onClick={saveHandover}
                disabled={!canSaveHandover}
                className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {editingId ? 'Update Handover' : 'Save Handover'}
              </button>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <SelectField label="Date" value={draft.handoffDate || ''} onChange={(value) => setDraft({ ...draft, handoffDate: value })} options={[]} type="date" />
            <SelectField label="Team" value={draft.team || defaultTeam} onChange={(value) => setDraft({ ...draft, team: value })} options={teamOptions} />
            <SelectField label="Region" value={draft.region || 'Regional'} onChange={(value) => setDraft({ ...draft, region: value })} options={REGION_OPTIONS} />
            <FreeTextField label="Outgoing Lead" value={draft.outgoingLead || ''} onChange={(value) => setDraft({ ...draft, outgoingLead: value })} options={owners} listId="outgoing-lead-options" placeholder="Type or select..." />
            <SelectField label="From Shift" value={draft.fromShift || 'Morning'} onChange={(value) => setDraft({ ...draft, fromShift: value as Handover['fromShift'] })} options={SHIFT_OPTIONS} />
            <FreeTextField label="Incoming Lead" value={draft.incomingLead || ''} onChange={(value) => setDraft({ ...draft, incomingLead: value })} options={owners} listId="incoming-lead-options" placeholder="Type or select..." />
            <SelectField label="To Shift" value={draft.toShift || 'Mid'} onChange={(value) => setDraft({ ...draft, toShift: value as Handover['toShift'] })} options={SHIFT_OPTIONS} />
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-900/30 dark:bg-orange-900/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gc-orange">Relay summary</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {draft.outgoingLead || 'Outgoing'} <ArrowRight className="inline h-3.5 w-3.5 text-gc-orange" /> {draft.incomingLead || 'Incoming'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{linkedTasks.length} linked task{linkedTasks.length === 1 ? '' : 's'} ready for transfer.</p>
            </div>
            <label className="md:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Shift Notes</span>
              <textarea
                className="settings-input min-h-28"
                value={draft.notes || ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="Capture blockers, watchouts, due actions, and anything the incoming lead must know."
              />
            </label>
          </div>
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Transfer Tasks</p>
                <p className="text-xs text-muted-foreground">Choose the live tasks that should move with this handover.</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">{linkedTasks.length} selected</span>
            </div>
            {activeTasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No active tasks available to transfer.
              </p>
            ) : (
              <div className="space-y-3">
                <select
                  className="settings-input"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    toggleTask(event.target.value);
                  }}
                >
                  <option value="">Add task to this handover...</option>
                  {availableTransferTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.priority} - {task.title} - {task.ownerId.trim()} - due {format(new Date(task.dueDate), 'MMM dd, h:mm a')}
                    </option>
                  ))}
                </select>
                <div className="space-y-2">
                  {linkedTasks.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                      No tasks selected. Use the dropdown above to attach only the tasks that matter.
                    </p>
                  ) : linkedTasks.map((task) => {
                    const overdue = !task.completed && new Date(task.dueDate) < new Date();
                    return (
                      <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{task.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {task.ownerId.trim()} - {task.campaignId} - due {format(new Date(task.dueDate), 'MMM dd, h:mm a')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', priorityTone(task.priority))}>
                            {task.priority}
                          </span>
                          {overdue && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                              Overdue
                            </span>
                          )}
                          <button onClick={() => toggleTask(task.id)} className="icon-btn" aria-label={`Remove ${task.title}`}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                <div className={cn('h-full rounded-full transition-all', readiness >= 80 ? 'bg-green-500' : readiness >= 50 ? 'bg-gc-orange' : 'bg-red-500')} style={{ width: `${readiness}%` }} />
              </div>
              <div className="space-y-3">
                <ReadinessItem ok={Boolean(draft.outgoingLead?.trim())} label="Outgoing lead selected" />
                <ReadinessItem ok={Boolean(draft.incomingLead?.trim())} label="Incoming lead selected" />
                <ReadinessItem ok={linkedTasks.length > 0} label="Relay contains task context" />
                <ReadinessItem ok={Boolean(draft.notes?.trim())} label="Shift notes captured" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="grid gap-3 border-b border-border bg-muted/30 p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="settings-input pl-9"
                  placeholder="Search lead, team, region..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <select className="settings-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Handover['status'])}>
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Reviewed">Reviewed</option>
              </select>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {filteredHandovers.map((handover) => {
                const relatedTasks = tasks.filter((task) => handover.taskIds.includes(task.id));
                return (
                  <div key={handover.id} className="border-b border-border p-5 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{handover.team}</h4>
                          <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase', statusTone(handover.status))}>{handover.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {handover.outgoingLead} <ArrowRight className="inline h-3.5 w-3.5 text-gc-orange" /> {handover.incomingLead}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{handover.region} · {handover.fromShift} to {handover.toShift} · {handover.handoffDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">{relatedTasks.length} tasks</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(handover.createdAt), 'MMM dd, HH:mm')}</p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{handover.notes || 'No notes recorded.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {relatedTasks.slice(0, 4).map((task) => (
                        <span key={task.id} className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground">
                          {task.title}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      {confirmDeleteId === handover.id ? (
                        <>
                          <span className="text-[11px] font-bold text-destructive">Delete this relay?</span>
                          <button onClick={() => removeHandover(handover)} className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white hover:bg-destructive/90">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-accent">No</button>
                        </>
                      ) : (
                        <>
                          {handover.status !== 'Reviewed' && (
                            <button onClick={() => acknowledge(handover)} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 dark:border-green-900/30 dark:bg-green-900/10 dark:text-green-400">
                              <CheckCircle2 size={14} />
                              {handover.status === 'Pending' ? 'Acknowledge' : 'Mark Reviewed'}
                            </button>
                          )}
                          <button onClick={() => startEdit(handover)} className="icon-btn"><Edit2 size={15} /></button>
                          <button onClick={() => setConfirmDeleteId(handover.id)} className="icon-btn text-destructive hover:bg-destructive/10"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredHandovers.length === 0 && (
                <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 text-gc-orange/60" />
                  <p className="text-sm font-semibold">No handovers match this filter yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreeTextField({
  label, value, onChange, options, listId, placeholder,
}: {
  label: string; value: string; onChange: (value: string) => void;
  options: string[]; listId: string; placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        className="settings-input"
        list={listId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  type = 'select',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  type?: 'select' | 'date';
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {type === 'date' ? (
        <input className="settings-input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <select className="settings-input" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )}
    </label>
  );
}

function ReadinessItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', ok ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
        {ok ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
      </div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );
}

function StatCard({ label, value, suffix = '', tone }: { label: string; value: number; suffix?: string; tone: 'orange' | 'green' | 'purple' | 'red' }) {
  const tones = {
    orange: 'text-gc-orange',
    green: 'text-green-600',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600',
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', tones[tone])}>{value}{suffix}</p>
    </div>
  );
}

function priorityTone(priority: Task['priority']) {
  if (priority === 'Critical') return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  if (priority === 'High') return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400';
  if (priority === 'Medium') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
}

function statusTone(status: Handover['status']) {
  if (status === 'Reviewed') return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  if (status === 'Acknowledged') return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
  return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400';
}
