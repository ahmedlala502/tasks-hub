import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Handover, Priority, Shift, Status, Task } from '../../types';
import { AlertCircle, ArrowDown, ArrowUp, Calendar, CheckCircle, Clock, Download, Filter, Globe, Loader2, Minus, MoreHorizontal, RefreshCw, Shield, Target, TrendingUp, Users, X } from 'lucide-react';
import { COUNTRY_FLAGS, TEAMS } from '../../constants';
import { motion } from 'motion/react';

interface ReportingProps {
  tasks: Task[];
  handovers: Handover[];
  stats: {
    openCount: number;
    riskCount: number;
    carryCount: number;
    handoverCount: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  'Done': '#10B981',
  'In Progress': '#3B82F6',
  'Waiting': '#F59E0B',
  'Blocked': '#EF4444',
  'Backlog': '#94A3B8',
};

const PRIORITY_COLORS: Record<string, string> = {
  'High': '#EF4444',
  'Medium': '#F59E0B',
  'Low': '#10B981',
};

const COLORS = ['#1E293B', '#F28C33', '#3B82F6', '#EF4444', '#10B981', '#6366F1', '#F59E0B'];

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 3).toUpperCase();
}

function groupCount<T>(items: T[], keyer: (item: T) => string) {
  const groups = items.reduce((acc, item) => {
    const key = keyer(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

const tooltipStyle = {
  borderRadius: '16px',
  border: '1px solid #E5E7EB',
  padding: '14px 18px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  background: 'rgba(255,255,255,0.98)',
  backdropFilter: 'blur(8px)',
  fontSize: '12px',
  fontWeight: 600,
};

const now = new Date();
const ReportingCharts = lazy(() => import('./ReportingCharts'));

export default function Reporting({ tasks, handovers, stats }: ReportingProps) {
  const [teamFilter, setTeamFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const teams = useMemo(() => ['All', ...new Set([...TEAMS, ...tasks.map(t => t.team)].filter(Boolean))], [tasks]);
  const countries = useMemo(() => ['All', ...new Set(tasks.map(t => t.country).filter(Boolean))], [tasks]);

  const filterByPeriod = (task: Task) => {
    if (periodFilter === 'all') return true;
    const d = new Date(task.createdAt);
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (periodFilter === 'today') return diff < 1;
    if (periodFilter === 'week') return diff < 7;
    return diff < 30;
  };

  const filteredTasks = useMemo(() => tasks.filter(task =>
    (teamFilter === 'All' || task.team === teamFilter) &&
    (countryFilter === 'All' || task.country === countryFilter) &&
    (shiftFilter === 'All' || task.shift === shiftFilter) &&
    filterByPeriod(task)
  ), [teamFilter, countryFilter, shiftFilter, periodFilter, tasks]);

  const total = filteredTasks.length;
  const completed = filteredTasks.filter(t => t.status === Status.DONE).length;
  const inProgress = filteredTasks.filter(t => t.status === Status.IN_PROGRESS).length;
  const blocked = filteredTasks.filter(t => t.status === Status.BLOCKED).length;
  const waiting = filteredTasks.filter(t => t.status === Status.WAITING).length;
  const backlog = filteredTasks.filter(t => t.status === Status.BACKLOG).length;
  const closureRate = total ? (completed / total) * 100 : 0;
  const riskItems = filteredTasks.filter(t => t.status !== Status.DONE && (t.status === Status.BLOCKED || t.priority === Priority.HIGH)).length;
  const carryItems = filteredTasks.filter(t => t.carry).length;
  const onTimeRate = total ? ((total - blocked - backlog) / total) * 100 : 0;

  const statusData = Object.values(Status).map(s => ({ name: s, value: filteredTasks.filter(t => t.status === s).length }));
  const priorityData = Object.values(Priority).map(p => ({ name: p, value: filteredTasks.filter(t => t.priority === p).length }));
  const shiftData = Object.values(Shift).map(s => ({
    name: s,
    open: filteredTasks.filter(t => t.shift === s && t.status !== Status.DONE).length,
    closed: filteredTasks.filter(t => t.shift === s && t.status === Status.DONE).length,
    handovers: handovers.filter(h => h.fromShift === s || h.toShift === s).length,
  }));
  const countryData = groupCount<Task>(filteredTasks, t => t.country || 'N/A');
  const teamData = groupCount<Task>(filteredTasks, t => t.team || 'Unassigned').map(item => ({
    ...item,
    closed: filteredTasks.filter(t => t.team === item.name && t.status === Status.DONE).length,
    risk: filteredTasks.filter(t => t.team === item.name && (t.priority === Priority.HIGH || t.status === Status.BLOCKED)).length,
  }));
  const officeData = groupCount<Task>(filteredTasks, t => t.office || 'Unassigned').map(item => ({
    ...item,
    risk: filteredTasks.filter(t => t.office === item.name && (t.priority === Priority.HIGH || t.status === Status.BLOCKED)).length,
  }));

  const userData = useMemo(() => {
    const grouped: Record<string, { name: string; total: number; closed: number; risk: number; countries: Set<string>; teams: Set<string> }> = {};
    filteredTasks.forEach(t => {
      const owner = t.owner || 'Unassigned';
      if (!grouped[owner]) grouped[owner] = { name: owner, total: 0, closed: 0, risk: 0, countries: new Set(), teams: new Set() };
      grouped[owner].total++;
      if (t.status === Status.DONE) grouped[owner].closed++;
      if (t.priority === Priority.HIGH || t.status === Status.BLOCKED) grouped[owner].risk++;
      if (t.country) grouped[owner].countries.add(t.country);
      if (t.team) grouped[owner].teams.add(t.team);
    });
    return Object.values(grouped).map(u => ({
      ...u,
      countries: [...u.countries].join(', '),
      teams: [...u.teams].join(', '),
      rate: u.total ? Math.round((u.closed / u.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filteredTasks]);

  const handleExportCSV = () => {
    setExporting(true);
    const headers = ['User', 'Teams', 'Countries', 'Total Tasks', 'Completed', 'Risk Items', 'Closure Rate'];
    const rows = userData.map(u => [u.name, u.teams, u.countries, u.total, u.closed, u.risk, `${u.rate}%`]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trygc-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 500);
  };

  const KPI_CARDS = [
    {
      label: 'Total Tasks',
      value: total,
      icon: Target,
      trend: `${stats.openCount} open in workspace`,
      color: 'text-ink',
      bg: 'bg-ink/5',
    },
    {
      label: 'Closure Rate',
      value: `${closureRate.toFixed(0)}%`,
      icon: CheckCircle,
      trend: `${completed} of ${total} completed`,
      color: closureRate >= 70 ? 'text-green-500' : closureRate >= 40 ? 'text-citrus' : 'text-red-500',
      bg: 'bg-green-500/5',
    },
    {
      label: 'On-Time Rate',
      value: `${onTimeRate.toFixed(0)}%`,
      icon: Clock,
      trend: `${blocked} blocked · ${backlog} backlog`,
      color: onTimeRate >= 70 ? 'text-green-500' : onTimeRate >= 40 ? 'text-citrus' : 'text-red-500',
      bg: 'bg-blue-500/5',
    },
    {
      label: 'Risk Items',
      value: riskItems,
      icon: Shield,
      trend: `${stats.riskCount} total workspace risk`,
      color: riskItems > 0 ? 'text-red-500' : 'text-green-500',
      bg: 'bg-red-500/5',
    },
    {
      label: 'Carry-Overs',
      value: carryItems,
      icon: RefreshCw,
      trend: `${filteredTasks.filter(t => t.carry && t.status !== Status.DONE).length} still open`,
      color: 'text-citrus',
      bg: 'bg-citrus/5',
    },
    {
      label: 'Active Agents',
      value: userData.filter(u => u.total > 0).length,
      icon: Users,
      trend: `${userData.length} total assigned`,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/5',
    },
  ];

  return (
    <div className="space-y-8 pb-24">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-ink rounded-2xl shadow-lg shadow-ink/10">
              <TrendingUp className="w-5 h-5 text-citrus" />
            </div>
            <div>
              <h2 className="relaxed-title text-2xl">Analytics & Reporting</h2>
              <p className="text-xs font-bold text-muted">Statistical synthesis of regional outcomes and closure rates</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showFilters ? 'bg-ink text-white border-ink' : 'bg-white border-dawn text-muted hover:text-ink'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(teamFilter !== 'All' || countryFilter !== 'All' || shiftFilter !== 'All' || periodFilter !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-citrus" />
            )}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting || userData.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink/90 transition-all disabled:opacity-40"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Filters Panel ── */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white border border-dawn rounded-3xl shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-muted">Filter Controls</span>
            <button onClick={() => setShowFilters(false)} className="p-1 text-muted hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FilterSelect label="Time Period" value={periodFilter} options={['all', 'today', 'week', 'month']} onChange={v => setPeriodFilter(v as any)} />
            <FilterSelect label="Team" value={teamFilter} options={teams} onChange={setTeamFilter} />
            <FilterSelect label="Country" value={countryFilter} options={countries} onChange={setCountryFilter} />
            <FilterSelect label="Shift" value={shiftFilter} options={['All', ...Object.values(Shift)]} onChange={setShiftFilter} />
          </div>
        </motion.div>
      )}

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_CARDS.map(kpi => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-white border border-dawn rounded-2xl hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted">{kpi.label}</span>
              <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
            </div>
            <span className="relaxed-title text-2xl font-black block">{kpi.value}</span>
            <span className="text-[9px] font-bold text-muted/60 mt-1 block truncate">{kpi.trend}</span>
          </motion.div>
        ))}
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <ReportingCharts
          total={total}
          statusData={statusData}
          priorityData={priorityData}
          shiftData={shiftData}
          teamData={teamData}
          countryData={countryData}
          officeData={officeData}
          statusColors={STATUS_COLORS}
          priorityColors={PRIORITY_COLORS}
          colors={COLORS}
          tooltipStyle={tooltipStyle}
        />
      </Suspense>

      {/* ── User Performance Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-dawn rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-dawn flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-citrus" />
            <div>
              <h3 className="relaxed-title text-lg">Per-User Performance</h3>
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest mt-0.5">Owner load · closure · risk · countries · teams</p>
            </div>
          </div>
          <span className="text-[9px] font-bold text-muted/40">{userData.length} agents</span>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-dawn bg-stone/30">
                {['Agent', 'Scope', 'Countries', 'Tasks', 'Done', 'Risk', 'Closure'].map(h => (
                  <th key={h} className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dawn">
              {userData.map(u => {
                const barColor = u.rate >= 75 ? 'bg-green-500' : u.rate >= 40 ? 'bg-citrus' : 'bg-red-500';
                return (
                  <tr key={u.name} className="hover:bg-stone/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-dawn rounded-xl flex items-center justify-center text-[10px] font-black text-muted border border-white shadow-sm">{initials(u.name)}</div>
                        <span className="text-sm font-bold text-ink">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-bold text-muted">{u.teams || '—'}</td>
                    <td className="px-6 py-4 text-[11px] font-bold">{u.countries.split(', ').filter(Boolean).map(c => `${COUNTRY_FLAGS[c] || ''} ${c}`).join('  ') || '—'}</td>
                    <td className="px-6 py-4 relaxed-title text-lg font-black">{u.total}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-green-600">{u.closed}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-black ${u.risk > 0 ? 'text-red-500' : 'text-muted/30'}`}>{u.risk}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-dawn rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${u.rate}%` }}
                            className={`h-full rounded-full ${barColor}`}
                          />
                        </div>
                        <span className={`text-[10px] font-black ${u.rate >= 75 ? 'text-green-600' : u.rate >= 40 ? 'text-citrus' : 'text-red-500'}`}>{u.rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-dawn">
          {userData.map(u => {
            const barColor = u.rate >= 75 ? 'bg-green-500' : u.rate >= 40 ? 'bg-citrus' : 'bg-red-500';
            return (
              <div key={u.name} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-dawn rounded-xl flex items-center justify-center text-[10px] font-black text-muted">{initials(u.name)}</div>
                    <div>
                      <span className="text-sm font-black text-ink">{u.name}</span>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-muted">
                        <span>{u.total} tasks</span>
                        <span>·</span>
                        <span className={u.risk > 0 ? 'text-red-500' : ''}>{u.risk} risk</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${u.rate >= 75 ? 'text-green-600' : u.rate >= 40 ? 'text-citrus' : 'text-red-500'}`}>{u.rate}%</span>
                </div>
                <div className="h-2 bg-dawn rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${u.rate}%` }} className={`h-full rounded-full ${barColor}`} />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-muted/60">
                  <span>{u.closed} done</span>
                  <span>{u.countries.split(', ').filter(Boolean).map(c => COUNTRY_FLAGS[c] || '').join(' ') || '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-stone/40 border border-dawn rounded-xl px-3 py-2.5 text-xs font-bold focus:border-citrus outline-none"
      >
        {options.map(o => (
          <option key={o} value={o}>{o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
        ))}
      </select>
    </label>
  );
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((item) => (
        <div key={item} className="p-5 bg-white border border-dawn rounded-2xl animate-pulse">
          <div className="h-4 w-32 bg-dawn rounded mb-3" />
          <div className="h-3 w-48 bg-dawn/70 rounded mb-5" />
          <div className="h-[200px] bg-stone rounded-xl" />
        </div>
      ))}
    </div>
  );
}
