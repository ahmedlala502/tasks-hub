import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Handover, Task, Shift, Priority, Status, HandoverTemplate } from '../../types';
import { RefreshCw, Calendar, MapPin, User, AlertTriangle, Send, CheckCircle2, ChevronRight, Info, Sparkles, Loader2, Clipboard, Globe, Users, ArrowRight, MessageSquare, History, Search, Layers, Quote, FileText, Bell } from 'lucide-react';
import { generateHandoverSummary, analyzeRisks } from '../../lib/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalData } from '../LocalDataContext';
import BulkCSVImport from '../BulkCSVImport';
import { COUNTRY_FLAGS, TEAMS, HANDOVER_TEMPLATES } from '../../constants';
import { cn, formatTime } from '../../utils';
import { addToast } from '../../lib/toast';

interface HandoverFlowProps {
  handovers: Handover[];
  tasks: Task[];
  stats: {
    openCount: number;
    riskCount: number;
    carryCount: number;
    handoverCount: number;
  };
  aiInteractions: { role: 'user' | 'assistant'; content: string; timestamp?: number }[];
}

const DRAFT_KEY = 'trygc_handover_draft_v1';

export default function HandoverFlow({ handovers, tasks, stats, aiInteractions }: HandoverFlowProps) {
  const { addHandover, updateHandover, offices, settings, user, members, currentTeam, canUseFeature, isWidgetEnabled, isMasterAdmin } = useLocalData();
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingHandoverId, setEditingHandoverId] = useState<string | null>(null);
  const [reviewingHandoverId, setReviewingHandoverId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewerFilter, setReviewerFilter] = useState<'all' | 'mine' | string>('all');
  const teamOptions = settings.teams?.length ? settings.teams : TEAMS;

  const [newHo, setNewHo] = useState<Partial<Handover>>(() => {
    // Auto-load draft from localStorage
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      fromShift: Shift.MORNING,
      toShift: Shift.MID,
      fromOffice: offices[0]?.name || 'Riyadh Office',
      toOffice: offices[1]?.name || 'Cairo HQ',
      team: teamOptions[0],
      country: user.country || 'EG',
      outgoing: user.name,
      incoming: '',
      watchouts: '',
      taskIds: [],
    };
  });

  // Auto-save draft every 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newHo));
      } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [newHo]);

  const assignableMembers = useMemo(() => {
    const pool = members.filter(member => !newHo.team || member.team === newHo.team);
    const deduped = new Map<string, typeof pool[number]>();
    pool.forEach(member => { if (!deduped.has(member.name)) deduped.set(member.name, member); });
    if (user.name && !deduped.has(user.name)) {
      deduped.set(user.name, { id: 'current-user', name: user.name, team: newHo.team || user.team || teamOptions[0], office: user.office, country: user.country, role: user.role, tasksCompleted: 0, handoversOut: 0, onTime: 0 });
    }
    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, newHo.team, teamOptions, user]);

  const activeTasks = useMemo(() => tasks.filter(t => newHo.taskIds?.includes(t.id)), [tasks, newHo.taskIds]);

  const autoSelectTasks = useCallback((useTemplate?: HandoverTemplate) => {
    if (useTemplate) {
      setNewHo(prev => ({
        ...prev,
        team: useTemplate.team,
        fromShift: useTemplate.fromShift,
        toShift: useTemplate.toShift,
        watchouts: (useTemplate.defaultWatchouts || '') + (prev.watchouts ? '\n\n' + prev.watchouts : ''),
        taskIds: tasks
          .filter(t => (t.carry || t.priority === Priority.HIGH) && t.status !== Status.DONE && (!prev.team || t.team === prev.team || t.team === useTemplate.team))
          .map(t => t.id),
      }));
    } else {
      const criticalIds = tasks
        .filter(t => (t.carry || t.priority === Priority.HIGH) && t.status !== Status.DONE && (!newHo.team || t.team === newHo.team))
        .map(t => t.id);
      setNewHo(prev => ({ ...prev, taskIds: criticalIds }));
    }
    setStep(3);
  }, [tasks, newHo.team]);

  const handleAIAnalysis = async () => {
    if (isAnalyzing || !canUseFeature('ai.use')) return;
    setIsAnalyzing(true);
    try {
      const taskData = activeTasks.map(t => ({ title: t.title, priority: t.priority, status: t.status }));
      const result = await generateHandoverSummary({ tasks: taskData, watchouts: newHo.watchouts });
      if (result.text) setNewHo(prev => ({ ...prev, watchouts: result.text.trim() }));
    } catch {
      addToast('AI analysis failed. Using fallback notes.', 'warning', 4000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveHandover = async () => {
    if (!newHo.incoming) {
      addToast('Please select an incoming lead before deploying.', 'error', 4000);
      return;
    }
    const fresh: Partial<Handover> = {
      date: new Date().toISOString().split('T')[0],
      fromShift: newHo.fromShift as Shift,
      toShift: newHo.toShift as Shift,
      fromOffice: newHo.fromOffice!,
      toOffice: newHo.toOffice!,
      team: newHo.team,
      country: newHo.country,
      outgoing: newHo.outgoing!,
      incoming: newHo.incoming,
      status: 'Pending',
      watchouts: newHo.watchouts,
      taskIds: newHo.taskIds || [],
      createdAt: new Date().toISOString(),
      creatorId: 'local-workspace',
      quality: 'good',
    };
    if (editingHandoverId) {
      await updateHandover(editingHandoverId, fresh);
    } else {
      await addHandover(fresh);
    }
    // Clear draft on success
    localStorage.removeItem(DRAFT_KEY);
    setStep(6);
  };

  const acknowledgeHandover = async (id: string) => {
    await updateHandover(id, { status: 'Acknowledged', ackAt: new Date().toISOString() });
    addToast('Handover acknowledged', 'success', 3000);
  };

  const reviewHandover = async (handover: Handover, action: 'Reviewed' | 'Acknowledged') => {
    const reviewedAt = new Date().toISOString();
    const trimmedComment = reviewComment.trim();
    const nextHistory = [...(handover.reviewHistory || []), { id: `review-${Date.now().toString(36)}`, reviewer: user.name, reviewedAt, comment: trimmedComment, action }];
    await updateHandover(handover.id, { reviewedBy: user.name, reviewedAt, reviewComment: trimmedComment, reviewHistory: nextHistory, ...(action === 'Acknowledged' ? { status: 'Acknowledged', ackAt: reviewedAt } : {}) });
    addToast(action === 'Acknowledged' ? 'Handover acknowledged with review' : 'Review saved', 'success', 3000);
  };

  const previewText = useMemo(() => {
    const sections = [
      `🔴 SHIFT HANDOVER: ${newHo.fromShift} → ${newHo.toShift}`,
      `🏢 HUB: ${newHo.fromOffice} → ${newHo.toOffice}`,
      `👥 TEAM: ${newHo.team || 'All teams'} | ${newHo.country || user.country}`,
      `👤 TRANSFERRED BY: ${newHo.outgoing} → ${newHo.incoming || 'TBD'}`,
      '',
      `📦 OUTCOMES (${activeTasks.length}):`,
      ...activeTasks.map((t, i) => `  ${i + 1}. [${t.priority}] ${t.title} (${t.status})`),
      '',
      `⚠️ WATCHOUTS:`,
      newHo.watchouts || 'No specific watchouts recorded. Please review all tasks carefully.',
    ];
    return sections.join('\n');
  }, [newHo, activeTasks, user.country]);

  const filteredTasks = tasks.filter(t =>
    t.status !== Status.DONE &&
    (!newHo.team || t.team === newHo.team) &&
    (t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.office.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (t.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const editHandover = (handover: Handover) => {
    setEditingHandoverId(handover.id);
    setNewHo({ ...handover, taskIds: handover.taskIds || [], team: handover.team || teamOptions[0], country: handover.country || user.country });
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReviewModal = (handover: Handover) => {
    setReviewComment(handover.reviewComment || '');
    setReviewingHandoverId(handover.id);
  };

  const resetBuilder = () => {
    setEditingHandoverId(null);
    localStorage.removeItem(DRAFT_KEY);
    setNewHo({
      fromShift: Shift.MORNING,
      toShift: Shift.MID,
      fromOffice: offices[0]?.name || 'Cairo HQ',
      toOffice: offices[1]?.name || 'Riyadh Office',
      team: teamOptions[0],
      country: user.country || 'EG',
      outgoing: user.name,
      incoming: '',
      watchouts: '',
      taskIds: [],
    });
    setStep(1);
  };

  const reviewingHandover = reviewingHandoverId ? handovers.find(h => h.id === reviewingHandoverId) || null : null;
  const reviewingTasks = reviewingHandover ? tasks.filter(t => reviewingHandover.taskIds.includes(t.id)) : [];

  const availableReviewers = useMemo(() => {
    return Array.from(new Set(handovers.flatMap(h => h.reviewHistory?.map(e => e.reviewer) || []).filter(Boolean))).sort();
  }, [handovers]);

  const filteredHandovers = useMemo(() => {
    if (reviewerFilter === 'all') return handovers;
    if (reviewerFilter === 'mine') return handovers.filter(h => h.reviewedBy === user.name || h.reviewHistory?.some(e => e.reviewer === user.name));
    return handovers.filter(h => h.reviewedBy === reviewerFilter || h.reviewHistory?.some(e => e.reviewer === reviewerFilter));
  }, [handovers, reviewerFilter, user.name]);

  const readiness = useMemo(() => {
    let score = 0;
    if (newHo.outgoing?.trim()) score += 20;
    if (newHo.incoming?.trim()) score += 20;
    if (newHo.fromOffice?.trim()) score += 10;
    if (newHo.toOffice?.trim()) score += 10;
    if (newHo.taskIds && newHo.taskIds.length > 0) score += 20;
    if (newHo.watchouts?.trim()) score += 20;
    return Math.min(100, score);
  }, [newHo]);

  const steps = ['Context', 'Setup', 'Outcomes', 'Insights', 'Preview', 'Success'];

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32">
      {/* ── Progress Bar ── */}
      <div className="grid grid-cols-6 gap-2">
        {steps.map((label, i) => (
          <div key={label} className="space-y-3">
            <motion.div className="h-1.5 rounded-full bg-dawn overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', step > i + 1 ? 'bg-citrus shadow-[0_0_10px_rgba(255,210,63,0.4)]' : step === i + 1 ? 'bg-citrus' : 'bg-transparent')}
                initial={{ width: 0 }}
                animate={{ width: step >= i + 1 ? '100%' : '0%' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
            </motion.div>
            <span className={cn('block text-[8px] font-black uppercase tracking-widest text-center transition-colors', step >= i + 1 ? 'text-ink' : 'text-muted/40')}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-card min-h-[500px] flex flex-col p-10 border-dawn shadow-2xl relative overflow-hidden">
        {/* Readiness indicator */}
        {step >= 2 && step <= 5 && (
          <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={cn(readiness >= 80 ? 'text-emerald-600' : readiness >= 50 ? 'text-amber-600' : 'text-red-500')}>
              {readiness}% Ready
            </span>
            <div className="w-16 h-1.5 bg-dawn rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', readiness >= 80 ? 'bg-emerald-500' : readiness >= 50 ? 'bg-amber-500' : 'bg-red-400')} style={{ width: `${readiness}%` }} />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Context */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} key="s1" className="flex flex-col items-center text-center py-10 space-y-8 max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-citrus/5 rounded-[40px] flex items-center justify-center border border-citrus/10 relative">
                <RefreshCw className="w-10 h-10 text-citrus animate-spin-slow" />
                <div className="absolute -right-2 -top-2 w-8 h-8 bg-ink text-white rounded-2xl flex items-center justify-center text-xs font-black shadow-lg">1</div>
              </div>
              <div className="space-y-4">
                <h2 className="relaxed-title text-4xl leading-tight">Initiate Shift Synchronization</h2>
                <p className="text-muted font-medium text-lg leading-relaxed">
                  Bridge the operational gap between team cycles. Critical risks and carry-overs are surfaced automatically.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                {[
                  { value: stats.openCount, label: 'Open' },
                  { value: stats.riskCount, label: 'Risks', color: 'text-red-500' },
                  { value: stats.carryCount, label: 'Carry-overs', color: 'text-citrus' },
                  { value: stats.handoverCount, label: 'Pending Handovers' },
                ].map(s => (
                  <div key={s.label} className="p-4 bg-stone/50 rounded-2xl border border-dawn">
                    <span className={cn('block text-2xl font-black mb-1', s.color || 'text-ink')}>{s.value}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Templates */}
              <div className="w-full space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted/60">Quick Start with Template</p>
                {HANDOVER_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => autoSelectTasks(tpl)}
                    className="w-full p-4 bg-white border border-dawn rounded-2xl flex items-center justify-between hover:border-citrus/40 hover:bg-citrus/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-citrus" />
                      <div className="text-left">
                        <span className="block text-sm font-bold text-ink">{tpl.name}</span>
                        <span className="text-[10px] font-medium text-muted">{tpl.description}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-citrus group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                <span className="px-3 py-2 bg-citrus/10 text-citrus rounded-xl">{currentTeam}</span>
                <span className="px-3 py-2 bg-white border border-dawn text-muted rounded-xl">{user.country}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)} className="flex items-center gap-3 px-10 py-4 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-ink/20 active:scale-95">
                  <span>Start Builder</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {isMasterAdmin && (
                  <BulkCSVImport
                    label="Import CSV"
                    description="Import handovers from CSV. Expected columns: date, fromShift, toShift, fromOffice, toOffice, outgoing, incoming, status, watchouts, team, country"
                    expectedHeaders={['fromShift', 'toShift', 'outgoing', 'incoming']}
                    onImport={async (rows) => {
                      for (const row of rows) {
                        await addHandover({
                          date: row.date || row.Date || new Date().toISOString().split('T')[0],
                          fromShift: (row.fromShift || row.fromshift || row.FromShift || 'Morning') as any,
                          toShift: (row.toShift || row.toshift || row.ToShift || 'Mid') as any,
                          fromOffice: row.fromOffice || row.FromOffice || offices[0]?.name || '',
                          toOffice: row.toOffice || row.ToOffice || offices[1]?.name || '',
                          outgoing: row.outgoing || row.Outgoing || user.name,
                          incoming: row.incoming || row.Incoming || 'TBD',
                          status: (row.status || row.Status || 'Pending') as any,
                          watchouts: row.watchouts || row.Watchouts || '',
                          team: row.team || row.Team || currentTeam,
                          country: row.country || row.Country || user.country,
                          taskIds: [],
                          creatorId: 'local-workspace',
                        });
                      }
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Topology */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="s2" className="space-y-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-citrus/10 rounded-xl"><Globe className="w-6 h-6 text-citrus" /></div>
                <div>
                  <h3 className="relaxed-title text-2xl">Regional Topology</h3>
                  <p className="text-xs font-bold text-muted/60 uppercase tracking-widest">Define the operational bridge</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Source */}
                <div className="p-6 bg-stone/20 rounded-3xl border border-dawn space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-citrus block">Source</span>
                  <div className="space-y-3">
                    {[
                      { label: 'Team', field: 'team', options: teamOptions },
                      { label: 'Country', field: 'country', options: Object.keys(COUNTRY_FLAGS), render: (v: string) => `${COUNTRY_FLAGS[v] || '🌍'} ${v}` },
                      { label: 'From Shift', field: 'fromShift', options: Object.values(Shift) },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="text-[9px] font-bold text-muted mb-1.5 block uppercase">{f.label}</label>
                        <select
                          value={(newHo as any)[f.field] || ''}
                          onChange={e => setNewHo(prev => ({ ...prev, [f.field]: e.target.value, taskIds: f.field === 'team' ? [] : prev.taskIds }))}
                          className="w-full bg-white border border-dawn rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-citrus/20"
                        >
                          {f.options.map(o => <option key={o} value={o}>{f.render ? f.render(o) : o}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className="text-[9px] font-bold text-muted mb-1.5 block uppercase">From Hub</label>
                      <select value={newHo.fromOffice || ''} onChange={e => setNewHo(prev => ({ ...prev, fromOffice: e.target.value }))} className="w-full bg-white border border-dawn rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none">
                        {[...new Set([newHo.fromOffice, ...offices.map(o => o.name)])].filter(Boolean).map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-muted mb-1.5 block uppercase">Outgoing Lead</label>
                      <select value={newHo.outgoing || ''} onChange={e => setNewHo(prev => ({ ...prev, outgoing: e.target.value }))} className="w-full bg-white border border-dawn rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none">
                        {assignableMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div className="p-6 bg-ink text-white rounded-3xl space-y-4 shadow-xl shadow-ink/20">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-citrus/80 block">Destination</span>
                  <div className="space-y-3">
                    {[
                      { label: 'To Shift', field: 'toShift', options: Object.values(Shift) },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="text-[9px] font-bold text-white/50 mb-1.5 block uppercase">{f.label}</label>
                        <select value={(newHo as any)[f.field] || ''} onChange={e => setNewHo(prev => ({ ...prev, [f.field]: e.target.value }))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none text-white appearance-none">
                          {f.options.map(o => <option key={o} className="text-ink">{o}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className="text-[9px] font-bold text-white/50 mb-1.5 block uppercase">To Hub</label>
                      <select value={newHo.toOffice || ''} onChange={e => setNewHo(prev => ({ ...prev, toOffice: e.target.value }))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none text-white">
                        {[...new Set([newHo.toOffice, ...offices.map(o => o.name)])].filter(Boolean).map(o => <option key={o} className="text-ink">{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-white/50 mb-1.5 block uppercase">Incoming Lead *</label>
                      <select value={newHo.incoming || ''} onChange={e => setNewHo(prev => ({ ...prev, incoming: e.target.value }))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none text-white">
                        <option value="" className="text-ink">Select receiver</option>
                        {assignableMembers.map(m => <option key={m.id} value={m.name} className="text-ink">{m.name}</option>)}
                      </select>
                      {!newHo.incoming && <p className="text-[9px] text-red-400 mt-1 font-bold">Required before deployment</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-10 border-t border-dawn">
                <button onClick={resetBuilder} className="text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">Reset</button>
                <button onClick={() => autoSelectTasks()} className="flex items-center gap-3 px-10 py-4 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95">
                  <span>Confirm Topology</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Outcome Selection */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="s3" className="space-y-6 flex flex-col h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-citrus/10 rounded-xl"><Layers className="w-6 h-6 text-citrus" /></div>
                  <div>
                    <h3 className="relaxed-title text-2xl">Outcome Selection</h3>
                    <p className="text-xs font-bold text-muted/60 uppercase tracking-widest">{newHo.taskIds?.length || 0} items selected</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input type="text" placeholder="Filter tasks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-stone/50 border border-dawn rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold focus:outline-none focus:border-citrus" />
                  </div>
                  <button
                    onClick={() => setNewHo(prev => ({ ...prev, taskIds: filteredTasks.map(t => t.id) }))}
                    className="text-[10px] font-black uppercase tracking-widest text-citrus hover:underline"
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-4 custom-scrollbar">
                {filteredTasks.map(t => {
                  const isSelected = newHo.taskIds?.includes(t.id);
                  return (
                    <motion.label
                      key={t.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer',
                        isSelected ? 'bg-citrus/5 border-citrus ring-1 ring-citrus/20' : 'bg-white border-dawn hover:border-citrus/30'
                      )}
                    >
                      <input type="checkbox" className="w-5 h-5 accent-citrus rounded-lg mt-0.5" checked={isSelected} onChange={e => {
                        const ids = newHo.taskIds || [];
                        setNewHo(prev => ({ ...prev, taskIds: e.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id) }));
                      }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="block text-sm font-bold text-ink truncate">{t.title}</span>
                          {t.priority === Priority.HIGH && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-muted/60">
                          <span>{t.owner}</span>
                          <span className="w-1 h-1 bg-dawn rounded-full" />
                          <span>{t.status}</span>
                          <span className="w-1 h-1 bg-dawn rounded-full" />
                          <span>{t.office}</span>
                          {t.carry && <span className="text-citrus ml-auto">Carry</span>}
                        </div>
                      </div>
                    </motion.label>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-8 border-t border-dawn">
                <button onClick={() => setStep(2)} className="text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">Change Topology</button>
                <button onClick={() => setStep(4)} className="flex items-center gap-3 px-10 py-4 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95">
                  <span>Analyze Sync</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Insights */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="s4" className="space-y-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-citrus/10 rounded-xl"><MessageSquare className="w-6 h-6 text-citrus" /></div>
                  <div>
                    <h3 className="relaxed-title text-2xl">Transfer Insights</h3>
                    <p className="text-xs font-bold text-muted/60 uppercase tracking-widest">Synthetic intelligence for the next team</p>
                  </div>
                </div>
                <button
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing || activeTasks.length === 0 || !canUseFeature('ai.use')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-citrus text-ink rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-citrus/10 disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Generate Summary</span>
                </button>
              </div>
              <div className="relative group">
                <div className="absolute top-4 left-4 opacity-5"><Quote className="w-10 h-10" /></div>
                <textarea
                  value={newHo.watchouts || ''}
                  onChange={e => setNewHo(prev => ({ ...prev, watchouts: e.target.value }))}
                  placeholder={`Enter critical knowledge for the incoming shift...\n\nSuggested format:\n1. Urgent actions required\n2. Blocked items & escalation paths\n3. Client-facing deliverables status\n4. Contact person for questions`}
                  className="w-full bg-stone/30 border border-dawn rounded-[24px] p-8 text-sm font-bold min-h-[250px] focus:outline-none focus:ring-4 focus:ring-citrus/5 focus:border-citrus transition-all resize-none shadow-inner leading-relaxed"
                />
              </div>
              <div className="flex justify-between items-center pt-8 border-t border-dawn">
                <button onClick={() => setStep(3)} className="text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">Adjust Outcomes</button>
                <button onClick={() => setStep(5)} className="flex items-center gap-3 px-10 py-4 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95">
                  <span>Preview Relay</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Preview */}
          {step === 5 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="s5" className="space-y-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-citrus/10 rounded-xl"><Clipboard className="w-6 h-6 text-citrus" /></div>
                  <div>
                    <h3 className="relaxed-title text-2xl">Final Protocol Relay</h3>
                    <p className="text-xs font-bold text-muted/60 uppercase tracking-widest">Verify and synchronize</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Preview */}
                <div className="p-6 bg-ink text-white rounded-[32px] shadow-2xl relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-citrus mb-5">Channel Payload</span>
                    <div className="bg-white/5 rounded-2xl p-5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto no-scrollbar border border-white/10">
                      {previewText}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(previewText); addToast('Copied to clipboard ready for Slack/Teams', 'success', 3000); }}
                      className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 bg-white text-ink rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-citrus transition-colors active:scale-98"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Copy for Slack / Teams</span>
                    </button>
                  </div>
                </div>

                {/* Confirm */}
                <div className="flex flex-col justify-between py-4">
                  <div className="space-y-6">
                    <div className="flex gap-4 p-4 border border-dawn rounded-2xl bg-stone/10">
                      <Users className="w-5 h-5 text-citrus shrink-0" />
                      <div className="flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-ink mb-2">Incoming Lead</span>
                        <select value={newHo.incoming || ''} onChange={e => setNewHo(prev => ({ ...prev, incoming: e.target.value }))} className="w-full bg-transparent text-sm font-bold text-ink focus:outline-none">
                          <option value="">Select receiver</option>
                          {assignableMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                        {!newHo.incoming && <p className="text-xs text-red-500 font-bold mt-2">Incoming lead must be selected before deploying</p>}
                      </div>
                    </div>
                    <div className="space-y-2 p-4 bg-stone/20 rounded-2xl">
                      <p className="text-xs font-bold text-muted">Deploying this relay will:</p>
                      <ul className="text-xs text-muted space-y-1 list-disc pl-4">
                        <li>Broadcast to all regional command centers</li>
                        <li>Lock {activeTasks.length} outcomes for handover</li>
                        <li>Notify {newHo.incoming || 'the incoming lead'} for acknowledgment</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-muted leading-relaxed italic border-l-4 border-l-citrus pl-4 mt-4">
                    Confirming this relay will broadcast the operational status across all regional command centers.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-8 border-t border-dawn">
                <button onClick={() => setStep(4)} className="text-xs font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">Edit Insights</button>
                <button
                  onClick={saveHandover}
                  disabled={!canUseFeature(editingHandoverId ? 'handover.edit' : 'handover.create') || !newHo.incoming}
                  className="flex items-center gap-3 px-10 py-4 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-ink/20 disabled:opacity-40 disabled:hover:scale-100 active:scale-95"
                >
                  <span>{editingHandoverId ? 'Update Relay' : 'Deploy Relay'}</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 6: Success */}
          {step === 6 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key="s6" className="text-center py-16 space-y-8">
              <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <div className="space-y-3">
                <h2 className="relaxed-title text-4xl">Relay Pulse Confirmed</h2>
                <p className="text-muted font-medium text-lg max-w-md mx-auto">
                  Operation bridge synchronized from <span className="text-ink font-bold">{newHo.fromShift}</span> to <span className="text-ink font-bold">{newHo.toShift}</span>
                </p>
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-muted">
                  <MapPin className="w-4 h-4" />
                  <span>{newHo.fromOffice} → {newHo.toOffice}</span>
                </div>
              </div>
              <div className="flex gap-4 justify-center pt-8">
                <button onClick={resetBuilder} className="px-8 py-3.5 bg-ink text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-ink/20 active:scale-95">
                  New Handover
                </button>
                <button onClick={() => setStep(1)} className="px-8 py-3.5 bg-white border border-dawn text-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-stone transition-all">
                  Return to Hub
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── History / Audit Table ── */}
      {isWidgetEnabled('handoverAudit') && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-muted" />
              <h3 className="relaxed-title text-2xl">Shift Transfer Audit</h3>
            </div>
            <select value={reviewerFilter} onChange={e => setReviewerFilter(e.target.value)} className="rounded-xl border border-dawn bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted focus:outline-none focus:ring-2 focus:ring-citrus/20">
              <option value="all">All reviews</option>
              <option value="mine">Reviewed by me</option>
              {availableReviewers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="glass-card p-0 overflow-hidden border-dawn shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-stone border-b border-dawn">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Time Pulse</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Bridge Corridor</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Team / Leads</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Outcomes</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dawn">
                  {filteredHandovers.map(ho => (
                    <tr key={ho.id} className="group hover:bg-stone/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-ink">{formatTime(ho.createdAt)}</span>
                          <span className="text-[9px] font-bold text-muted/50 uppercase">{new Date(ho.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-ink">{ho.fromShift}</span>
                          <ArrowRight className="w-3 h-3 text-muted/40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-ink">{ho.toShift}</span>
                        </div>
                        <span className="text-[9px] font-bold text-muted/60">{ho.fromOffice} → {ho.toOffice}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-citrus mb-1.5">{ho.team || 'All Teams'}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            <div className="w-5 h-5 bg-stone border-2 border-white rounded-full flex items-center justify-center text-[7px] font-black text-muted">{ho.outgoing[0]}</div>
                            <div className="w-5 h-5 bg-dawn border-2 border-white rounded-full flex items-center justify-center text-[7px] font-black text-muted">{ho.incoming?.[0] || '?'}</div>
                          </div>
                          <span className="text-[10px] font-bold text-muted">{ho.outgoing} / {ho.incoming || 'TBD'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-citrus rounded-full" />
                          <span className="text-[11px] font-bold text-ink">{ho.taskIds.length} synced</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {ho.reviewHistory?.some(e => e.reviewer === user.name) && (
                            <span className="px-2.5 py-1.5 rounded-lg bg-ink/5 text-ink text-[9px] font-black uppercase tracking-widest border border-dawn">Reviewed</span>
                          )}
                          <button onClick={() => openReviewModal(ho)} className="px-3.5 py-1.5 bg-ink text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-ink/10 active:scale-95">Review</button>
                          <button onClick={() => editHandover(ho)} disabled={!canUseFeature('handover.edit')} className="px-3.5 py-1.5 bg-white border border-dawn text-muted rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-citrus transition-all disabled:opacity-30">Edit</button>
                          {ho.status === 'Pending' ? (
                            <button onClick={() => acknowledgeHandover(ho.id)} disabled={!canUseFeature('handover.ack')} className="px-4 py-1.5 bg-citrus text-ink rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-citrus/10 disabled:opacity-30 active:scale-95">Ack</button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] uppercase tracking-widest">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Sync Clear</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredHandovers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted opacity-30 italic">
                          {reviewerFilter === 'all' ? 'No handovers recorded yet' : 'No handovers match this filter'}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewingHandover && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setReviewingHandoverId(null)} />
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }} className="relative w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-[32px] border border-dawn bg-white shadow-2xl">
              <div className="flex items-center justify-between px-8 py-6 border-b border-dawn">
                <div>
                  <h3 className="relaxed-title text-2xl">Handover Review</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mt-2">
                    {reviewingHandover.fromShift} → {reviewingHandover.toShift} · {reviewingHandover.team} · {reviewingHandover.country}
                  </p>
                </div>
                <button onClick={() => setReviewingHandoverId(null)} className="px-4 py-2 bg-stone border border-dawn rounded-xl text-[10px] font-black uppercase tracking-widest text-muted hover:text-ink transition-all">
                  Close
                </button>
              </div>

              <div className="p-8 overflow-y-auto max-h-[calc(88vh-96px)] custom-scrollbar space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-stone/30 rounded-3xl border border-dawn space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-citrus block">Transfer Context</span>
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold text-ink">
                      {[
                        ['Outgoing', reviewingHandover.outgoing],
                        ['Incoming', reviewingHandover.incoming],
                        ['From Hub', reviewingHandover.fromOffice],
                        ['To Hub', reviewingHandover.toOffice],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-0.5">{k}</p>
                          <p>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 bg-ink text-white rounded-3xl space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-citrus/80 block">Review Status</span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white/70">State</span>
                      <span className={cn('px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest', reviewingHandover.status === 'Pending' ? 'bg-citrus text-ink' : 'bg-emerald-500 text-white')}>{reviewingHandover.status}</span>
                    </div>
                    <div className="space-y-2 text-sm font-bold text-white/80">
                      <p>Created: {new Date(reviewingHandover.createdAt).toLocaleString()}</p>
                      <p>Tasks: {reviewingTasks.length}</p>
                      {reviewingHandover.reviewedBy && <p>Reviewed by: {reviewingHandover.reviewedBy}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="relaxed-title text-xl">Watchouts</h4>
                  <div className="p-6 bg-stone/20 border border-dawn rounded-3xl text-sm font-medium text-muted leading-relaxed whitespace-pre-wrap min-h-[120px]">
                    {reviewingHandover.watchouts || 'No watchouts recorded.'}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="relaxed-title text-xl">Reviewer Notes</h4>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="Add your review notes, feedback, or follow-ups..."
                    className="w-full min-h-[120px] rounded-3xl border border-dawn bg-white px-5 py-4 text-sm font-medium text-ink placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-citrus/20"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="relaxed-title text-xl">Linked Tasks ({reviewingTasks.length})</h4>
                  <div className="space-y-3">
                    {reviewingTasks.map(task => (
                      <div key={task.id} className="p-4 bg-white border border-dawn rounded-2xl flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-black uppercase tracking-widest text-muted">
                            <span>{task.team}</span><span className="text-muted/30">·</span><span>{task.office}</span><span className="text-muted/30">·</span><span>{task.owner}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn('inline-block px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest',
                            task.status === Status.BLOCKED ? 'bg-red-50 text-red-500' : task.status === Status.DONE ? 'bg-emerald-50 text-emerald-600' : 'bg-stone text-muted'
                          )}>{task.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-dawn">
                  <span className="text-[10px] font-bold text-muted">Review notes saved to audit trail</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setReviewingHandoverId(null); editHandover(reviewingHandover); }} disabled={!canUseFeature('handover.edit')} className="px-5 py-2.5 bg-white border border-dawn rounded-xl text-[10px] font-black uppercase tracking-widest text-muted hover:text-citrus transition-all disabled:opacity-30">
                      Edit
                    </button>
                    <button onClick={async () => { await reviewHandover(reviewingHandover, 'Reviewed'); setReviewingHandoverId(null); }} className="px-5 py-2.5 bg-ink text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-ink/10 active:scale-95">
                      Save Review
                    </button>
                    {reviewingHandover.status === 'Pending' && (
                      <button onClick={async () => { await reviewHandover(reviewingHandover, 'Acknowledged'); setReviewingHandoverId(null); }} className="px-5 py-2.5 bg-citrus text-ink rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-citrus/10 active:scale-95">
                        Ack & Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
