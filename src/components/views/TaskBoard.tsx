import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Task, Status, Priority, Shift } from '../../types';
import { Search, Filter, MoreHorizontal, ArrowUpDown, Clock, AlertCircle, CheckCircle2, Plus, ChevronDown, ChevronUp, RefreshCw, Trash2, UserPlus, CheckSquare, Square, X, Loader2, LayoutGrid, List, MapPin, Flag, Calendar, User, GripVertical, Bell, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TaskModal from '../TaskModal';
import { COUNTRY_FLAGS, TEAMS } from '../../constants';
import { useLocalData } from '../LocalDataContext';
import BulkCSVImport from '../BulkCSVImport';
import { cn } from '../../utils';
import { addToast } from '../../lib/toast';

interface TaskBoardProps {
  tasks: Task[];
  initialFilter?: string;
  initialStatus?: string;
}

const STATUS_META: Record<string, { label: string; color: string; dot: string; bg: string; hoverBg: string }> = {
  [Status.BACKLOG]: { label: 'Backlog', color: 'text-gray-500', dot: 'bg-gray-400', bg: 'bg-gray-50 border-gray-200', hoverBg: 'bg-gray-100' },
  [Status.IN_PROGRESS]: { label: 'In Progress', color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200', hoverBg: 'bg-blue-100' },
  [Status.WAITING]: { label: 'Waiting', color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', hoverBg: 'bg-amber-100' },
  [Status.BLOCKED]: { label: 'Blocked', color: 'text-red-600', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200', hoverBg: 'bg-red-100' },
  [Status.DONE]: { label: 'Done', color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', hoverBg: 'bg-emerald-100' },
};

const PRIORITY_META: Record<string, { label: string; color: string; border: string; icon: React.ReactNode }> = {
  [Priority.HIGH]: { label: 'High', color: 'text-red-600', border: 'border-l-red-500', icon: <AlertCircle className="w-3 h-3" /> },
  [Priority.MEDIUM]: { label: 'Medium', color: 'text-amber-600', border: 'border-l-amber-500', icon: <Flag className="w-3 h-3" /> },
  [Priority.LOW]: { label: 'Low', color: 'text-blue-600', border: 'border-l-blue-500', icon: <ArrowUpDown className="w-3 h-3 rotate-45" /> },
};

const STATUS_FLOW: Status[] = [Status.BACKLOG, Status.IN_PROGRESS, Status.WAITING, Status.BLOCKED, Status.DONE];

export default function TaskBoard({ tasks, initialFilter = '', initialStatus = 'All' }: TaskBoardProps) {
  const { user, currentTeam, addTask, updateTask, deleteTasks, canUseFeature, isMasterAdmin } = useLocalData();
  const [filter, setFilter] = useState(initialFilter);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Task | 'title'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isProcessing, setIsProcessing] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [shiftFilter, setShiftFilter] = useState<string>('All');
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  React.useEffect(() => {
    setFilter(initialFilter);
    setStatusFilter(initialStatus);
  }, [initialFilter, initialStatus]);

  const handleSort = (field: keyof Task | 'title') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const filteredTasks = useMemo(() => tasks.filter(t =>
    (statusFilter === 'All' || t.status === statusFilter) &&
    (teamFilter === 'All' || t.team === teamFilter) &&
    (countryFilter === 'All' || t.country === countryFilter) &&
    (shiftFilter === 'All' || t.shift === shiftFilter) &&
    (filter.toLowerCase() === 'risk'
      ? (t.priority === Priority.HIGH || t.status === Status.BLOCKED) && t.status !== Status.DONE
      : filter.toLowerCase() === 'carry'
        ? t.carry && t.status !== Status.DONE
        : filter.toLowerCase() === 'overdue'
          ? t.status !== Status.DONE && new Date(t.due) < new Date()
          : !filter || t.title.toLowerCase().includes(filter.toLowerCase()) || t.owner.toLowerCase().includes(filter.toLowerCase()) || t.office.toLowerCase().includes(filter.toLowerCase()) || (t.country && t.country.toLowerCase().includes(filter.toLowerCase())) || (t.team && t.team.toLowerCase().includes(filter.toLowerCase())))
  ), [tasks, statusFilter, teamFilter, countryFilter, shiftFilter, filter]);

  const teamOptions = useMemo(() => ['All', ...new Set(tasks.map(t => t.team).filter(Boolean))], [tasks]);
  const countryOptions = useMemo(() => ['All', ...new Set(tasks.map(t => t.country).filter(Boolean))], [tasks]);
  const shiftOptions = useMemo(() => ['All', ...new Set(tasks.map(t => t.shift).filter(Boolean))], [tasks]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    let valA: any = a[sortField as keyof Task];
    let valB: any = b[sortField as keyof Task];
    if (sortField === 'priority') {
      const weights: Record<string, number> = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
      valA = weights[a.priority] || 0;
      valB = weights[b.priority] || 0;
    }
    if (valA == null) valA = '';
    if (valB == null) valB = '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  }), [filteredTasks, sortField, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedTasks.length) setSelectedIds([]);
    else setSelectedIds(sortedTasks.map(t => t.id));
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatus = async (status: Status) => {
    setIsProcessing(true);
    await Promise.all(selectedIds.map(id => updateTask(id, { status, completedAt: status === Status.DONE ? new Date().toISOString() : undefined })));
    setSelectedIds([]);
    setIsProcessing(false);
  };

  const handleBulkPriority = async (priority: Priority) => {
    setIsProcessing(true);
    await Promise.all(selectedIds.map(id => updateTask(id, { priority })));
    setSelectedIds([]);
    setIsProcessing(false);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Permanently delete ${selectedIds.length} task(s)? This cannot be undone.`)) {
      setIsProcessing(true);
      await deleteTasks(selectedIds);
      setSelectedIds([]);
      setIsProcessing(false);
      addToast(`${selectedIds.length} task(s) deleted`, 'info', 3000);
    }
  };

  const handleBulkAssign = async (owner: string) => {
    setIsProcessing(true);
    await Promise.all(selectedIds.map(id => updateTask(id, { owner })));
    setSelectedIds([]);
    setIsProcessing(false);
  };

  // ── Drag and Drop ──
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(task.id);
    // Add subtle animation class to dragged element
    if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: Status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    setDragOverStatus(null);
    if (!taskId || !canUseFeature('task.edit')) return;

    await updateTask(taskId, {
      status: targetStatus,
      completedAt: targetStatus === Status.DONE ? new Date().toISOString() : undefined,
    });
  }, [updateTask, canUseFeature]);

  const toggleStatus = async (id: string, currentStatus: Status) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    const next = STATUS_FLOW[(idx + 1) % STATUS_FLOW.length];
    await updateTask(id, { status: next, completedAt: next === Status.DONE ? new Date().toISOString() : undefined });
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
      setEditingTask(null);
      return;
    }
    await addTask({
      ...taskData,
      creatorId: 'local-workspace',
      country: taskData.country || 'KSA',
      team: taskData.team || TEAMS[0],
      status: taskData.status || Status.BACKLOG,
      priority: taskData.priority || Priority.MEDIUM,
      owner: taskData.owner || user.name,
    });
  };

  const openCount = sortedTasks.filter(t => t.status !== Status.DONE).length;
  const riskCount = sortedTasks.filter(t => t.status !== Status.DONE && (t.status === Status.BLOCKED || t.priority === Priority.HIGH)).length;

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto">
          <button
            onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
            disabled={!canUseFeature('task.create')}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-ink/10 hover:bg-ink/90 transition-all shrink-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
          {isMasterAdmin && (
            <BulkCSVImport
              label="Import CSV"
              description="Import tasks from a CSV file. Expected columns: title, campaign, owner, due, estimatedHours, priority, status, team, office, country, shift, details"
              expectedHeaders={['title', 'campaign', 'owner', 'due']}
              onImport={async (rows) => {
                for (const row of rows) {
                  await addTask({
                    title: row.title || row.Title || 'Untitled',
                    priority: (row.priority || row.Priority || 'Medium') as any,
                    status: (row.status || row.Status || 'Backlog') as any,
                    owner: row.owner || row.Owner || user.name,
                    team: row.team || row.Team || currentTeam,
                    office: row.office || row.Office || user.office,
                    country: row.country || row.Country || user.country,
                    shift: (row.shift || row.Shift || 'Morning') as any,
                    due: row.due || row.Due || new Date().toISOString(),
                    campaign: row.campaign || row.Campaign || '',
                    estimatedHours: Number(row.estimatedHours || row.EstimatedHours || row.duration || row.Duration || row.slaHrs || row.SlaHrs) || undefined,
                    details: row.details || row.Details || '',
                    creatorId: 'local-workspace',
                  });
                }
              }}
            />
          )}
          <div className="flex items-center gap-1.5">
            {['All', ...Object.values(Status)].map(s => {
              const meta = STATUS_META[s];
              const count = s === 'All' ? tasks.length : tasks.filter(t => t.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap',
                    statusFilter === s
                      ? 'bg-ink text-white border-ink shadow-sm'
                      : 'bg-white text-muted border-dawn hover:border-ink/30 hover:text-ink'
                  )}
                >
                  {s !== 'All' && <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta?.dot || 'bg-dawn'} mr-1.5 align-middle`} />}
                  {s === 'All' ? 'All Tasks' : meta?.label || s}
                  <span className={cn('ml-1.5 px-1 py-0.5 rounded text-[8px]', statusFilter === s ? 'bg-white/15' : 'bg-stone')}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <div className="flex bg-white border border-dawn rounded-xl p-0.5 shadow-sm">
            {(['table', 'kanban'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn('p-2 rounded-lg transition-all', viewMode === mode ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink')}
                title={`${mode} view`}
              >
                {mode === 'table' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('p-2 rounded-lg transition-all border', showFilters ? 'bg-citrus/10 border-citrus/30 text-citrus' : 'bg-white border-dawn text-muted')}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <div className="relative flex-1 lg:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full lg:w-48 pl-9 pr-4 py-2 bg-white border border-dawn rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-citrus/20 focus:border-citrus transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Advanced Filters ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-dawn rounded-2xl p-4">
              {[
                { label: 'Team', value: teamFilter, set: setTeamFilter, options: teamOptions, labels: { All: 'All Teams' } },
                { label: 'Country', value: countryFilter, set: setCountryFilter, options: countryOptions, labels: { All: 'All Countries' } },
                { label: 'Shift', value: shiftFilter, set: setShiftFilter, options: shiftOptions, labels: { All: 'All Shifts' } },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted shrink-0">{f.label}</span>
                  <select
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="flex-1 bg-stone/50 border border-dawn rounded-xl px-3 py-2 text-xs font-bold focus:border-citrus outline-none"
                  >
                    {f.options.map(o => <option key={o} value={o}>{(f.labels as Record<string, string>)?.[o] || o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'All', value: '' },
          { label: 'Open Only', value: 'Open' },
          { label: 'Risks', value: 'risk' },
          { label: 'Carry-overs', value: 'carry' },
          { label: 'Overdue', value: 'overdue' },
        ].map(preset => (
          <button
            key={preset.value}
            onClick={() => {
              setFilter(preset.value);
              if (preset.value === 'Open') {
                setStatusFilter('All');
              } else if (preset.value === 'risk') {
                // no-op - handled by filter logic
              }
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              filter === preset.value || (preset.value === '' && filter === '')
                ? 'bg-ink text-white'
                : 'bg-white border border-dawn text-muted hover:text-ink hover:border-ink/20'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── Summary bar ── */}
      <div className="flex items-center gap-4 text-[10px] font-bold text-muted bg-white border border-dawn rounded-2xl px-5 py-3 flex-wrap">
        <span>{sortedTasks.length} tasks {(filter || statusFilter !== 'All' || teamFilter !== 'All' || countryFilter !== 'All' || shiftFilter !== 'All') ? '(filtered)' : ''}</span>
        <span className="text-muted/30">|</span>
        <span className="text-blue-600">{openCount} open</span>
        <span className="text-muted/30">|</span>
        <span className="text-emerald-600">{sortedTasks.filter(t => t.status === Status.DONE).length} done</span>
        {riskCount > 0 && (<><span className="text-muted/30">|</span><span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{riskCount} risks</span></>)}
        {sortedTasks.filter(t => t.carry).length > 0 && (<><span className="text-muted/30">|</span><span className="text-citrus">{sortedTasks.filter(t => t.carry).length} carry-overs</span></>)}
      </div>

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 min-h-96">
          {STATUS_FLOW.map(status => {
            const meta = STATUS_META[status];
            const laneTasks = sortedTasks.filter(t => t.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
                className={cn(
                  'flex flex-col bg-stone/30 rounded-3xl border overflow-hidden transition-all duration-200',
                  dragOverStatus === status ? 'border-citrus bg-citrus/5 shadow-lg ring-2 ring-citrus/20 scale-[1.02]' : 'border-dawn/50'
                )}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-dawn/50 bg-white/40">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', meta?.dot || 'bg-dawn')} />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-ink">{meta?.label || status}</h4>
                    <span className="px-1.5 py-0.5 bg-white border border-dawn rounded-md text-[8px] font-bold text-muted">{laneTasks.length}</span>
                  </div>
                  <button
                    onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                    disabled={!canUseFeature('task.create')}
                    className="p-1 text-muted hover:text-ink transition-colors rounded-lg hover:bg-stone"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 p-3 custom-scrollbar">
                  <AnimatePresence>
                    {laneTasks.map(task => {
                      const pMeta = PRIORITY_META[task.priority];
                      const isOverdue = task.status !== Status.DONE && new Date(task.due) < new Date();
                      return (
                        <div
                          key={task.id}
                          draggable={canUseFeature('task.edit')}
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          style={{ opacity: draggingTaskId === task.id ? 0.4 : 1 }}
                          className={cn(
                            'bg-white border-l-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group',
                            pMeta?.border || 'border-l-dawn',
                            expandedTaskId === task.id ? 'ring-2 ring-citrus/20' : 'border-t border-r border-b border-dawn',
                            isOverdue && 'shadow-red-100'
                          )}
                        >
                          <div className="p-3.5">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className={cn('text-xs font-bold leading-snug', task.status === Status.DONE ? 'text-muted line-through' : 'text-ink')}>
                                {task.title}
                              </span>
                              <span className="text-base flex-shrink-0 leading-none">{COUNTRY_FLAGS[task.country] || '🌍'}</span>
                            </div>

                            {expandedTaskId === task.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="mb-2"
                              >
                                <p className="text-[11px] text-muted leading-relaxed mt-1">{task.details || 'No details provided.'}</p>
                                {task.blockedReason && (
                                  <div className="mt-2 p-2 bg-red-50 rounded-lg text-[10px] font-bold text-red-600">
                                    Blocked: {task.blockedReason}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {task.tags?.map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 bg-stone rounded-md text-[8px] font-bold text-muted uppercase">{tag}</span>
                                  ))}
                                </div>
                              </motion.div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                              <div className="flex items-center gap-1 text-[8px] font-bold text-muted/60 uppercase tracking-tighter">
                                <MapPin className="w-2.5 h-2.5 opacity-50" />
                                {task.office}
                              </div>
                              <span className="text-muted/20">·</span>
                              <div className="flex items-center gap-1 text-[8px] font-bold text-muted/60">
                                <Clock className="w-2.5 h-2.5 opacity-50" />
                                {isOverdue ? (
                                  <span className="text-red-500">Overdue</span>
                                ) : (
                                  new Date(task.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                                )}
                              </div>
                              <span className="text-muted/20">·</span>
                              <div className="flex items-center gap-1 text-[8px] font-bold text-citrus uppercase">
                                <Clock className="w-2.5 h-2.5 opacity-70" />
                                SLA {task.estimatedHours ? `${task.estimatedHours}h` : 'Due'}
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-dawn/40">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-stone border border-dawn rounded-full flex items-center justify-center text-[7px] font-black text-muted">
                                  {task.owner.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[8px] font-bold uppercase tracking-wider text-muted/50">{task.shift}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {task.carry && (
                                  <span className="px-1 py-0.5 bg-citrus/10 text-citrus rounded text-[7px] font-black uppercase tracking-wider">Carry</span>
                                )}
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleStatus(task.id, task.status); }}
                                    className="p-1 text-muted/40 hover:text-citrus rounded transition-colors"
                                    title="Cycle status"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); setIsModalOpen(true); }}
                                    disabled={!canUseFeature('task.edit')}
                                    className="p-1 text-muted/40 hover:text-ink rounded transition-colors"
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </AnimatePresence>
                  {laneTasks.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        'p-6 text-center border-2 border-dashed rounded-2xl transition-colors',
                        dragOverStatus === status ? 'border-citrus/60 bg-citrus/5' : 'border-dawn/30'
                      )}
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/30 italic">
                        {dragOverStatus === status ? 'Drop tasks here' : 'Empty lane'}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <div className="bg-white border border-dawn rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone/40 border-b border-dawn sticky top-0 z-10">
                  <th className="px-5 py-4 w-10">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center text-muted hover:text-citrus transition-colors">
                      {selectedIds.length > 0 && selectedIds.length === sortedTasks.length
                        ? <CheckSquare className="w-4 h-4 text-citrus" />
                        : <Square className="w-4 h-4 opacity-20 hover:opacity-60" />}
                    </button>
                  </th>
                  <th onClick={() => handleSort('title')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      Task
                      {sortField === 'title' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('country')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      Country
                      {sortField === 'country' ? (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('office')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Office{sortField === 'office' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th onClick={() => handleSort('owner')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Owner{sortField === 'owner' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th onClick={() => handleSort('priority')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Priority{sortField === 'priority' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th onClick={() => handleSort('status')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Status{sortField === 'status' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th onClick={() => handleSort('due')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">Due{sortField === 'due' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th onClick={() => handleSort('estimatedHours')} className="px-5 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted cursor-pointer hover:text-ink transition-colors group whitespace-nowrap">
                    <div className="flex items-center gap-1.5">SLA{sortField === 'estimatedHours' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-citrus" /> : <ChevronDown className="w-3 h-3 text-citrus" />) : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-60" />}</div>
                  </th>
                  <th className="px-5 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dawn/60">
                {sortedTasks.map(task => {
                  const pMeta = PRIORITY_META[task.priority];
                  const sMeta = STATUS_META[task.status];
                  const isOverdue = task.status !== Status.DONE && new Date(task.due) < new Date();
                  return (
                    <React.Fragment key={task.id}>
                      <tr
                        draggable={canUseFeature('task.edit')}
                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                        className={cn(
                          'group transition-colors cursor-pointer hover:bg-stone/20',
                          expandedTaskId === task.id ? 'bg-stone/10' : '',
                          selectedIds.includes(task.id) ? 'bg-citrus/3' : ''
                        )}
                      >
                        <td className="px-5 py-4" onClick={e => toggleSelect(e, task.id)}>
                          <div className="flex items-center justify-center">
                            {selectedIds.includes(task.id)
                              ? <CheckSquare className="w-4 h-4 text-citrus" />
                              : <Square className="w-4 h-4 opacity-20 group-hover:opacity-60" />}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {task.status === Status.DONE
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : <div className={cn('w-4 h-4 rounded-full border-2', isOverdue ? 'border-red-400' : 'border-dawn')} />}
                            </div>
                            <div className="min-w-0">
                              <span className={cn('block text-sm font-bold leading-snug truncate max-w-[280px]', task.status === Status.DONE ? 'text-muted line-through' : 'text-ink')}>{task.title}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {task.carry && <span className="text-[7px] font-black uppercase tracking-wider text-citrus bg-citrus/5 px-1 py-0.5 rounded">Carry</span>}
                                {task.tags?.map(tag => <span key={tag} className="text-[8px] font-bold text-muted/50">{tag}</span>)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><span className="text-xs font-bold">{COUNTRY_FLAGS[task.country] || '🌍'} {task.country}</span></td>
                        <td className="px-5 py-4"><span className="text-xs font-bold text-muted whitespace-nowrap">{task.office}</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-stone border border-dawn rounded-full flex items-center justify-center text-[8px] font-bold text-muted flex-shrink-0">
                              {task.owner.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-muted truncate max-w-[100px]">{task.owner}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border',
                            task.priority === Priority.HIGH ? 'bg-red-50 text-red-600 border-red-200'
                            : task.priority === Priority.MEDIUM ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200'
                          )}>
                            {pMeta?.icon}
                            {pMeta?.label}
                          </span>
                        </td>
                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleStatus(task.id, task.status)}
                            disabled={!canUseFeature('task.edit')}
                            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-stone/60 transition-colors"
                          >
                            <span className={cn('w-2 h-2 rounded-full', sMeta?.dot || 'bg-dawn')} />
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted">{sMeta?.label || task.status}</span>
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className={cn('flex items-center gap-1.5 text-xs font-bold', isOverdue ? 'text-red-500' : 'text-muted')}>
                            <Calendar className="w-3 h-3 opacity-50" />
                            <span>{new Date(task.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-citrus/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-citrus">
                            <Clock className="w-3 h-3" />
                            {task.estimatedHours ? `${task.estimatedHours}h` : 'Due'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditingTask(task); setIsModalOpen(true); }}
                            disabled={!canUseFeature('task.edit')}
                            className="p-1.5 rounded-lg hover:bg-stone/60 transition-colors text-muted opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedTaskId === task.id && (
                        <tr className="bg-stone/5 border-b border-dawn/60">
                          <td colSpan={10} className="px-16 py-6">
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="md:col-span-2 space-y-4">
                                <div>
                                  <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-2">Details</span>
                                  <p className="text-sm font-medium text-muted leading-relaxed whitespace-pre-wrap">{task.details || 'No additional notes.'}</p>
                                </div>
                                {task.blockedReason && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-600">{task.blockedReason}</div>
                                )}
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-2">Metadata</span>
                                  <div className="space-y-2 bg-white border border-dawn rounded-2xl p-4">
                                    {[
                                      ['Campaign', task.campaign || 'General'],
                                      ['Team', task.team],
                                      ['Shift', task.shift],
                                      ['Est. Hours', task.estimatedHours ? `${task.estimatedHours}h` : '—'],
                                      ['Created', new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                                    ].map(([k, v]) => (
                                      <div key={k} className="flex justify-between text-[11px] font-bold">
                                        <span className="text-muted/50">{k}</span>
                                        <span className="text-ink">{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredTasks.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-stone/50 rounded-2xl">
                  <Search className="w-8 h-8 text-muted/30" />
                </div>
                <h3 className="text-lg font-bold text-ink">No tasks found</h3>
                <p className="text-sm font-medium text-muted">Try adjusting your search or filters above.</p>
                <button
                  onClick={() => { setFilter(''); setStatusFilter('All'); setTeamFilter('All'); setCountryFilter('All'); setShiftFilter('All'); }}
                  className="px-4 py-2 bg-stone border border-dawn rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTask} initialTask={editingTask} />

      {/* ── Bulk Actions Bar ── */}
      <AnimatePresence>
        {selectedIds.length > 0 && canUseFeature('task.bulk') && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] px-5 py-3.5 bg-ink/95 text-white rounded-2xl shadow-2xl flex items-center gap-5 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2.5 pr-5 border-r border-white/10">
              <span className="flex items-center justify-center w-6 h-6 bg-citrus text-white rounded-lg text-[10px] font-black">{selectedIds.length}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Selected</span>
              <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-1"><X className="w-3.5 h-3.5 opacity-50" /></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="group relative">
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all text-[9px] font-black uppercase tracking-wider">Status <ChevronDown className="w-3 h-3" /></button>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white text-ink rounded-xl border border-dawn shadow-2xl overflow-hidden p-1 min-w-[150px]">
                  {STATUS_FLOW.map(s => (
                    <button key={s} onClick={() => handleBulkStatus(s)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-stone text-[10px] font-bold uppercase tracking-wider transition-colors rounded-lg">
                      <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_META[s]?.dot || 'bg-dawn')} />{STATUS_META[s]?.label || s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="group relative">
                <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all text-[9px] font-black uppercase tracking-wider">Priority <ChevronDown className="w-3 h-3" /></button>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white text-ink rounded-xl border border-dawn shadow-2xl overflow-hidden p-1 min-w-[150px]">
                  {Object.values(Priority).map(p => (
                    <button key={p} onClick={() => handleBulkPriority(p)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-stone text-[10px] font-bold uppercase tracking-wider transition-colors rounded-lg">
                      {PRIORITY_META[p]?.icon}{PRIORITY_META[p]?.label || p}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { const name = window.prompt('Assign all selected to:'); if (name) handleBulkAssign(name); }} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all text-[9px] font-black uppercase tracking-wider">
                <UserPlus className="w-3 h-3" /> Assign
              </button>
              <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500 rounded-xl transition-all text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-white ml-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
