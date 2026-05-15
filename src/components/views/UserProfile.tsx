import React, { useMemo, useState } from 'react';
import { User, TrendingUp, CheckCircle2, AlertCircle, Clock, Zap, Award, Activity, Target, ChevronRight, X, Filter, Calendar, BarChart3 } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { Card } from '../ui/card';
import { calculateMemberMetrics, getPerformanceSummary, generatePerformanceAlerts } from '../../lib/performanceService';
import { useLocalData } from '../LocalDataContext';
import { Task, Status, Member, PerformanceMetrics, Handover } from '../../types';
import { formatDistance, parseISO, format } from 'date-fns';

interface BreakdownModalProps {
  title: string;
  icon: React.ReactNode;
  items: { title: string; subtitle: string; badge?: string; badgeColor?: string; date?: string }[];
  onClose: () => void;
  totalLabel?: string;
  totalValue?: string | number;
}

function BreakdownModal({ title, icon, items, onClose, totalLabel, totalValue }: BreakdownModalProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="sticky top-0 z-10 bg-white border-b border-dawn p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-citrus/10 rounded-xl">{icon}</div>
              <div>
                <h2 className="text-xl font-black text-ink">{title}</h2>
                {totalLabel && totalValue !== undefined && (
                  <p className="text-xs font-bold text-muted">{totalLabel}: <span className="text-citrus">{totalValue}</span></p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone transition-colors">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-stone/50 border border-dawn hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink text-sm truncate">{item.title}</p>
                        <p className="text-xs text-muted mt-0.5">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest whitespace-nowrap ${item.badgeColor || 'bg-stone text-muted'}`}>
                            {item.badge}
                          </span>
                        )}
                        {item.date && (
                          <span className="text-[10px] font-bold text-muted/60">{item.date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-muted/30 mx-auto mb-3" />
                <p className="font-bold text-ink">No data available</p>
                <p className="text-sm text-muted mt-1">Nothing to show in this category yet.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function UserProfilePage() {
  const shouldReduceMotion = useReducedMotion();
  const { user, members, tasks, handovers } = useLocalData();
  const normalizedUserName = user.name.trim().toLowerCase();

  const [activeBreakdown, setActiveBreakdown] = useState<string | null>(null);

  const currentMember = useMemo((): Member => {
    const exactMember = members.find(
      (m: Member) => m.name.trim().toLowerCase() === normalizedUserName
    );

    if (exactMember) return exactMember;

    return {
      id: `profile-${normalizedUserName || 'user'}`,
      name: user.name,
      team: user.team || 'Unassigned',
      office: user.office || 'N/A',
      country: user.country || 'N/A',
      role: user.role || 'User',
      tasksCompleted: 0,
      handoversOut: 0,
      onTime: 0,
      updatedAt: new Date().toISOString(),
      status: 'active',
    };
  }, [members, normalizedUserName, user.country, user.name, user.office, user.role, user.team]);

  const metrics = useMemo((): PerformanceMetrics => {
    return calculateMemberMetrics(currentMember.id, currentMember, tasks, handovers);
  }, [currentMember, tasks, handovers]);

  const userTasks = useMemo((): Task[] => {
    return tasks.filter((t: Task) => t.owner.trim().toLowerCase() === normalizedUserName);
  }, [normalizedUserName, tasks]);

  const completedTasks = useMemo(() => userTasks.filter(t => t.status === Status.DONE), [userTasks]);
  const inProgressTasks = useMemo(() => userTasks.filter(t => t.status === Status.IN_PROGRESS), [userTasks]);
  const blockedTasks = useMemo(() => userTasks.filter(t => t.status === Status.BLOCKED), [userTasks]);
  const backlogTasks = useMemo(() => userTasks.filter(t => t.status === Status.BACKLOG), [userTasks]);
  const waitingTasks = useMemo(() => userTasks.filter(t => t.status === Status.WAITING), [userTasks]);

  const userHandovers = useMemo((): Handover[] => {
    return handovers.filter(h => h.outgoing.trim().toLowerCase() === normalizedUserName || h.incoming.trim().toLowerCase() === normalizedUserName);
  }, [normalizedUserName, handovers]);

  const outgoingHandovers = useMemo(() => userHandovers.filter(h => h.outgoing.trim().toLowerCase() === normalizedUserName), [userHandovers, normalizedUserName]);
  const acknowledgedHandovers = useMemo(() => outgoingHandovers.filter(h => h.status === 'Acknowledged'), [outgoingHandovers]);
  const pendingHandovers = useMemo(() => outgoingHandovers.filter(h => h.status === 'Pending'), [outgoingHandovers]);

  const totalTasks = userTasks.length;
  const completionRatio = totalTasks > 0 ? Math.round((metrics.tasksCompleted / totalTasks) * 100) : 0;
  const workloadRatio = totalTasks > 0 ? Math.round((metrics.tasksInProgress / totalTasks) * 100) : 0;

  const alerts = useMemo((): string[] => {
    return generatePerformanceAlerts(metrics);
  }, [metrics]);

  const formatTaskDate = (dateStr: string) => {
    try {
      return formatDistance(parseISO(dateStr), new Date(), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case Status.DONE: return 'bg-emerald/10 text-emerald border-emerald/20';
      case Status.IN_PROGRESS: return 'bg-sky/10 text-sky border-sky/20';
      case Status.BLOCKED: return 'bg-red/10 text-red border-red/20';
      case Status.WAITING: return 'bg-amber/10 text-amber border-amber/20';
      default: return 'bg-stone text-muted border-dawn';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red text-white';
      case 'Medium': return 'bg-amber text-white';
      default: return 'bg-sky text-white';
    }
  };

  const motionProps = shouldReduceMotion
    ? { initial: false, animate: false as const }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  const completedTaskItems = completedTasks.map(t => ({
    title: t.title,
    subtitle: t.details || t.campaign || `${t.team} • ${t.office}`,
    badge: t.priority,
    badgeColor: getPriorityColor(t.priority),
    date: t.completedAt ? formatTaskDate(t.completedAt) : formatTaskDate(t.updatedAt),
  }));

  const inProgressTaskItems = inProgressTasks.map(t => ({
    title: t.title,
    subtitle: t.details || t.campaign || `${t.team} • ${t.office}`,
    badge: t.priority,
    badgeColor: getPriorityColor(t.priority),
    date: formatTaskDate(t.updatedAt),
  }));

  const blockedTaskItems = blockedTasks.map(t => ({
    title: t.title,
    subtitle: t.blockedReason || t.details || `${t.team} • ${t.office}`,
    badge: 'Blocked',
    badgeColor: 'bg-red text-white',
    date: t.blockedSince ? formatTaskDate(t.blockedSince) : formatTaskDate(t.updatedAt),
  }));

  const handoverItems = outgoingHandovers.map(h => ({
    title: `${h.fromShift} → ${h.toShift}`,
    subtitle: `${h.fromOffice} → ${h.toOffice} • ${h.team}`,
    badge: h.status,
    badgeColor: h.status === 'Acknowledged' ? 'bg-emerald/10 text-emerald border-emerald/20' : 'bg-amber/10 text-amber border-amber/20',
    date: formatTaskDate(h.createdAt),
  }));

  const allTaskItems = [...userTasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(t => ({
      title: t.title,
      subtitle: t.details || t.campaign || `${t.team} • ${t.office}`,
      badge: t.status,
      badgeColor: getStatusColor(t.status),
      date: formatTaskDate(t.updatedAt),
    }));

  const recentTasks = useMemo((): Task[] => {
    return [...userTasks]
      .sort((a: Task, b: Task) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [userTasks]);

  return (
    <div className="space-y-8 pb-12">
      <AnimatePresence>
        {activeBreakdown === 'completed' && (
          <BreakdownModal
            title="Tasks Completed"
            icon={<CheckCircle2 className="w-5 h-5 text-citrus" />}
            items={completedTaskItems}
            totalLabel="Total"
            totalValue={metrics.tasksCompleted}
            onClose={() => setActiveBreakdown(null)}
          />
        )}
        {activeBreakdown === 'inprogress' && (
          <BreakdownModal
            title="Tasks In Progress"
            icon={<Activity className="w-5 h-5 text-sky" />}
            items={inProgressTaskItems}
            totalLabel="Total"
            totalValue={metrics.tasksInProgress}
            onClose={() => setActiveBreakdown(null)}
          />
        )}
        {activeBreakdown === 'blocked' && (
          <BreakdownModal
            title="Blocked Tasks"
            icon={<AlertCircle className="w-5 h-5 text-amber" />}
            items={blockedTaskItems}
            totalLabel="Total"
            totalValue={metrics.tasksBlocked}
            onClose={() => setActiveBreakdown(null)}
          />
        )}
        {activeBreakdown === 'handovers' && (
          <BreakdownModal
            title="Handovers"
            icon={<Target className="w-5 h-5 text-sky" />}
            items={handoverItems}
            totalLabel="Outgoing"
            totalValue={metrics.handoversOut}
            onClose={() => setActiveBreakdown(null)}
          />
        )}
        {activeBreakdown === 'alltasks' && (
          <BreakdownModal
            title="All Tasks"
            icon={<BarChart3 className="w-5 h-5 text-citrus" />}
            items={allTaskItems}
            totalLabel="Total"
            totalValue={totalTasks}
            onClose={() => setActiveBreakdown(null)}
          />
        )}
      </AnimatePresence>

      {/* Premium Hero Banner */}
      <motion.div
        {...motionProps}
        className="relative overflow-hidden rounded-[32px] border border-dawn bg-ink p-8 shadow-2xl group cursor-pointer transition-all hover:shadow-citrus/20"
        onClick={() => window.location.hash = '#settings'}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-citrus/20 blur-[80px] transition-all group-hover:bg-citrus/30 group-hover:scale-110 duration-700" />
          <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-sky/20 blur-[80px] transition-all group-hover:bg-sky/30 group-hover:scale-110 duration-700" />
        </div>

        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between z-10">
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl group-hover:scale-105 transition-transform duration-500">
              <User className="h-12 w-12 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">{user.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs font-bold tracking-widest uppercase backdrop-blur-md border border-white/10">
                  {user.role}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/80 font-medium text-sm">{currentMember.team}</span>
              </div>
              <p className="text-sm text-white/50 mt-2 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active in {currentMember.office}, {currentMember.country}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-[280px]">
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Completion</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-black text-white">{completionRatio}</p>
                <p className="text-sm font-bold text-white/50 mb-1">%</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Workload</p>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-black text-white">{workloadRatio}</p>
                <p className="text-sm font-bold text-white/50 mb-1">%</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards - Clickable with breakdowns */}
      <motion.div
        {...motionProps}
        transition={{ delay: shouldReduceMotion ? 0 : 0.08 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <button onClick={() => setActiveBreakdown('completed')} className="text-left w-full focus:outline-none">
          <Card className="p-6 h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] group bg-white border-dawn hover:border-citrus/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-citrus text-white opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-ink transition-colors">Tasks Completed</p>
              <div className="p-2 rounded-xl bg-stone group-hover:bg-white group-hover:shadow-sm transition-all">
                <CheckCircle2 className="w-5 h-5 text-citrus" />
              </div>
            </div>
            <p className="text-4xl font-black text-ink mb-1 group-hover:text-citrus transition-colors">{metrics.tasksCompleted}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">{metrics.thisMonthCompleted} this month</p>
            <div className="mt-3 pt-3 border-t border-dawn/50 flex items-center gap-1 text-xs font-bold text-citrus">
              <Filter className="w-3 h-3" /> View breakdown
            </div>
          </Card>
        </button>

        <button onClick={() => setActiveBreakdown('inprogress')} className="text-left w-full focus:outline-none">
          <Card className="p-6 h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] group bg-white border-dawn hover:border-sky/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky text-white opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-ink transition-colors">In Progress</p>
              <div className="p-2 rounded-xl bg-stone group-hover:bg-white group-hover:shadow-sm transition-all">
                <Activity className="w-5 h-5 text-sky" />
              </div>
            </div>
            <p className="text-4xl font-black text-ink mb-1 group-hover:text-sky transition-colors">{metrics.tasksInProgress}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">Currently active</p>
            <div className="mt-3 pt-3 border-t border-dawn/50 flex items-center gap-1 text-xs font-bold text-sky">
              <Filter className="w-3 h-3" /> View breakdown
            </div>
          </Card>
        </button>

        <button onClick={() => setActiveBreakdown('blocked')} className="text-left w-full focus:outline-none">
          <Card className="p-6 h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] group bg-white border-dawn hover:border-amber/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber text-white opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-ink transition-colors">Blocked</p>
              <div className="p-2 rounded-xl bg-stone group-hover:bg-white group-hover:shadow-sm transition-all">
                <AlertCircle className="w-5 h-5 text-amber" />
              </div>
            </div>
            <p className="text-4xl font-black text-ink mb-1 group-hover:text-amber transition-colors">{metrics.tasksBlocked}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">Needs attention</p>
            <div className="mt-3 pt-3 border-t border-dawn/50 flex items-center gap-1 text-xs font-bold text-amber">
              <Filter className="w-3 h-3" /> View breakdown
            </div>
          </Card>
        </button>

        <button onClick={() => setActiveBreakdown('handovers')} className="text-left w-full focus:outline-none">
          <Card className="p-6 h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] group bg-white border-dawn hover:border-emerald/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald text-white opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-ink transition-colors">Handovers Out</p>
              <div className="p-2 rounded-xl bg-stone group-hover:bg-white group-hover:shadow-sm transition-all">
                <Target className="w-5 h-5 text-emerald" />
              </div>
            </div>
            <p className="text-4xl font-black text-ink mb-1 group-hover:text-emerald transition-colors">{metrics.handoversOut}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">{metrics.handoversAcknowledged} acknowledged</p>
            <div className="mt-3 pt-3 border-t border-dawn/50 flex items-center gap-1 text-xs font-bold text-emerald">
              <Filter className="w-3 h-3" /> View breakdown
            </div>
          </Card>
        </button>
      </motion.div>

      {/* Additional Stats Row */}
      <motion.div
        {...motionProps}
        transition={{ delay: shouldReduceMotion ? 0 : 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <button onClick={() => setActiveBreakdown('alltasks')} className="text-left w-full focus:outline-none">
          <Card className="p-5 h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.02] group bg-white border-dawn">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Total Tasks</p>
                <p className="text-3xl font-black text-ink mt-1">{totalTasks}</p>
                <p className="text-[10px] font-bold text-muted/60 mt-1">{backlogTasks.length} backlog • {waitingTasks.length} waiting</p>
              </div>
              <BarChart3 className="w-8 h-8 text-citrus/50" />
            </div>
          </Card>
        </button>

        <Card className="p-5 h-full bg-white border-dawn">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">On-Time Rate</p>
              <p className="text-3xl font-black text-ink mt-1">{metrics.onTimeRate}%</p>
              <p className="text-[10px] font-bold text-muted/60 mt-1">Delivery reliability</p>
            </div>
            <TrendingUp className="w-8 h-8 text-sky/50" />
          </div>
        </Card>

        <Card className="p-5 h-full bg-white border-dawn">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">Quality Score</p>
              <p className="text-3xl font-black text-ink mt-1">{metrics.qualityScore}</p>
              <p className="text-[10px] font-bold text-muted/60 mt-1">Out of 100</p>
            </div>
            <Award className="w-8 h-8 text-emerald/50" />
          </div>
        </Card>
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div
          {...motionProps}
          transition={{ delay: shouldReduceMotion ? 0 : 0.12 }}
          className="rounded-2xl border border-amber/30 bg-gradient-to-r from-amber/10 to-amber/5 p-6 cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-300"
          onClick={() => window.location.hash = '#tasks'}
        >
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber" />
            </div>
            <div>
              <h3 className="font-black text-amber mb-2 tracking-tight">Attention Required</h3>
              <ul className="space-y-1.5">
                {alerts.map((alert: string, idx: number) => (
                  <li key={idx} className="text-sm font-medium text-amber/90 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber" />
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Workload & Handover Health */}
      <motion.div
        {...motionProps}
        transition={{ delay: shouldReduceMotion ? 0 : 0.16 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <button 
          onClick={() => setActiveBreakdown('alltasks')}
          className="lg:col-span-2 text-left w-full focus:outline-none"
        >
          <Card className="p-8 h-full hover:shadow-xl hover:border-citrus/30 hover:scale-[1.01] transition-all duration-300 group bg-white/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-ink flex items-center gap-3">
                <div className="p-2 bg-citrus/10 rounded-xl group-hover:bg-citrus/20 transition-colors">
                  <Activity className="w-5 h-5 text-citrus" />
                </div>
                Workload Snapshot
              </h3>
              <ChevronRight className="w-5 h-5 text-muted group-hover:text-citrus transition-colors" />
            </div>

            <div className="space-y-6">
              <ProgressRow label="In Progress" value={metrics.tasksInProgress} total={totalTasks} barClass="bg-sky" />
              <ProgressRow label="Blocked" value={metrics.tasksBlocked} total={totalTasks} barClass="bg-amber" />
              <ProgressRow label="Done" value={metrics.tasksCompleted} total={totalTasks} barClass="bg-emerald" />
            </div>
          </Card>
        </button>

        <button 
          onClick={() => setActiveBreakdown('handovers')}
          className="text-left w-full focus:outline-none"
        >
          <Card className="p-8 h-full hover:shadow-xl hover:border-sky/30 hover:scale-[1.01] transition-all duration-300 group bg-white/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-ink flex items-center gap-3">
                <div className="p-2 bg-sky/10 rounded-xl group-hover:bg-sky/20 transition-colors">
                  <Target className="w-5 h-5 text-sky" />
                </div>
                Handover Health
              </h3>
              <ChevronRight className="w-5 h-5 text-muted group-hover:text-sky transition-colors" />
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone/50 border border-dawn flex items-center justify-between group-hover:bg-white transition-colors">
                <span className="text-xs font-black uppercase tracking-widest text-muted">Outgoing</span>
                <span className="text-xl font-black text-ink">{metrics.handoversOut}</span>
              </div>
              <div className="p-4 rounded-2xl bg-stone/50 border border-dawn flex items-center justify-between group-hover:bg-white transition-colors">
                <span className="text-xs font-black uppercase tracking-widest text-muted">Acknowledged</span>
                <span className="text-xl font-black text-emerald">{metrics.handoversAcknowledged}</span>
              </div>
              <div className="p-4 rounded-2xl bg-stone/50 border border-dawn flex items-center justify-between group-hover:bg-white transition-colors">
                <span className="text-xs font-black uppercase tracking-widest text-muted">Pending</span>
                <span className="text-xl font-black text-amber">{pendingHandovers.length}</span>
              </div>
              
              <div className="mt-6 p-4 rounded-2xl bg-emerald/5 border border-emerald/10 text-center">
                <p className="text-sm font-bold text-emerald">
                  {metrics.handoversOut === 0
                    ? 'No active handovers'
                    : `${Math.round((metrics.handoversAcknowledged / metrics.handoversOut) * 100)}% acknowledgement rate`}
                </p>
              </div>
            </div>
          </Card>
        </button>
      </motion.div>

      {/* AI Performance Summary */}
      <motion.button
        {...motionProps}
        transition={{ delay: shouldReduceMotion ? 0 : 0.2 }}
        onClick={() => window.location.hash = '#ai'}
        className="w-full text-left rounded-[24px] border border-citrus/20 bg-gradient-to-r from-citrus/5 to-transparent p-6 hover:shadow-lg hover:border-citrus/40 hover:scale-[1.01] transition-all duration-300 group focus:outline-none"
      >
        <h3 className="font-black text-ink mb-3 flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-citrus" />
          AI Performance Synthesis
        </h3>
        <p className="text-muted font-medium leading-relaxed group-hover:text-ink/80 transition-colors">
          {getPerformanceSummary(metrics)}
        </p>
      </motion.button>

      {/* Recent Tasks */}
      <motion.div
        {...motionProps}
        transition={{ delay: shouldReduceMotion ? 0 : 0.24 }}
        className="space-y-6 pt-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-ink tracking-tight">Recent Activity</h3>
          <button 
            onClick={() => setActiveBreakdown('alltasks')}
            className="text-xs font-black uppercase tracking-widest text-citrus hover:text-ink transition-colors flex items-center gap-1"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        
        {recentTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentTasks.map((task: Task) => (
              <button 
                key={task.id} 
                onClick={() => window.location.hash = '#tasks'}
                className="text-left focus:outline-none w-full"
              >
                <Card className="p-5 h-full transition-all duration-300 hover:shadow-xl hover:border-citrus/30 hover:-translate-y-1 bg-white group">
                  <div className="flex flex-col h-full justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="font-black text-ink text-lg leading-tight group-hover:text-citrus transition-colors line-clamp-2">{task.title}</p>
                        <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest whitespace-nowrap border ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-muted line-clamp-2">{task.details}</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-dawn/50">
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest hover:brightness-95 transition-all ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className="text-[10px] font-bold text-muted/60 uppercase tracking-widest">
                        {formatTaskDate(task.updatedAt)}
                      </span>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed border-2 border-dawn bg-stone/30">
            <div className="w-16 h-16 rounded-full bg-stone mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-muted/40" />
            </div>
            <p className="text-lg font-black text-ink mb-2">You're all caught up!</p>
            <p className="text-sm font-medium text-muted">No recent tasks assigned to your profile.</p>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  barClass,
}: {
  label: string;
  value: number;
  total: number;
  barClass: string;
}) {
  const ratio = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2 group cursor-pointer">
      <div className="flex items-center justify-between text-sm">
        <span className="text-xs font-black uppercase tracking-widest text-muted group-hover:text-ink transition-colors">{label}</span>
        <span className="font-black text-ink">{value} <span className="text-muted font-bold text-[10px]">({ratio}%)</span></span>
      </div>
      <div className="h-3 w-full rounded-full bg-stone overflow-hidden group-hover:bg-stone/80 transition-colors">
        <div className={`h-full rounded-full ${barClass} group-hover:brightness-110 transition-all`} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}
