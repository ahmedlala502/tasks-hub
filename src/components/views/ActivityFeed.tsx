import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown,
  ChevronUp, Clock, Download, Filter, Info, Search, Shield, Trash2, X,
} from 'lucide-react';
import { useLocalData } from '../LocalDataContext';
import { AuditEvent } from '../../lib/localStore';
import { addToast } from '../../lib/toast';

// ── helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SEVERITY_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  info:     { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Info' },
  warning:  { icon: AlertTriangle, color: 'text-amber-500',  bg: 'bg-amber-50',  label: 'Warning' },
  error:    { icon: AlertCircle,   color: 'text-red-500',    bg: 'bg-red-50',    label: 'Error' },
  critical: { icon: AlertCircle,   color: 'text-red-700',    bg: 'bg-red-100',   label: 'Critical' },
};

// colour-coded action labels
const ACTION_COLOUR: Record<string, string> = {
  LOGIN_SUCCESS:          'text-green-600',
  LOGIN_FAILED:           'text-red-500',
  LOGOUT:                 'text-muted',
  TASK_CREATE:            'text-blue-600',
  TASK_UPDATE:            'text-blue-400',
  TASK_DELETE:            'text-red-400',
  HANDOVER_INITIATE:      'text-indigo-600',
  HANDOVER_UPDATE:        'text-indigo-400',
  HANDOVER_DELETE:        'text-red-400',
  HANDOVER_ACKNOWLEDGE:   'text-green-500',
  MEMBER_CREATE:          'text-citrus',
  MEMBER_UPDATE:          'text-citrus',
  MEMBER_DELETE:          'text-red-400',
  OFFICE_REGISTER:        'text-purple-600',
  OFFICE_UPDATE:          'text-purple-400',
  OFFICE_DELETE:          'text-red-400',
  SETTINGS_UPDATE:        'text-ink',
  PROFILE_UPDATE:         'text-muted',
  SIGNUP_REQUEST:         'text-citrus',
  SIGNUP_APPROVED:        'text-green-600',
  SIGNUP_REJECTED:        'text-red-400',
  EXPORT_WORKSPACE_JSON:  'text-teal-600',
  EXPORT_TASKS_CSV:       'text-teal-500',
  EXPORT_HANDOVERS_CSV:   'text-teal-500',
  EXPORT_MEMBERS_CSV:     'text-teal-500',
  EXPORT_OFFICES_CSV:     'text-teal-500',
  EXPORT_AUDIT_CSV:       'text-teal-500',
  IMPORT_WORKSPACE_JSON:  'text-orange-500',
  PASSWORD_CHANGED:       'text-amber-600',
};

function actionColor(action: string) {
  return ACTION_COLOUR[action] || 'text-ink';
}

function resolveDisplayName(userId: string | undefined, users: { email: string; name: string }[]): string {
  if (!userId) return '';
  const match = users.find(u => u.email.toLowerCase() === userId.toLowerCase());
  return match?.name || userId.split('@')[0];
}

// ── EventRow ─────────────────────────────────────────────────────────────────
function EventRow({ event, idx, users }: { event: AuditEvent; idx: number; users: { email: string; name: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_META[event.severity || 'info'] || SEVERITY_META.info;
  const SevIcon = sev.icon;
  const displayName = resolveDisplayName(event.userId, users);

  const details = useMemo(() => {
    if (!event.details || (typeof event.details === 'object' && Object.keys(event.details as object).length === 0)) return null;
    try { return JSON.stringify(event.details, null, 2); } catch { return String(event.details); }
  }, [event.details]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
      className="border-b border-dawn last:border-0"
    >
      <div
        className="flex items-start gap-3 px-4 py-3 hover:bg-stone/30 transition-colors cursor-pointer select-none"
        onClick={() => details && setExpanded(v => !v)}
      >
        {/* Severity icon */}
        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${sev.bg}`}>
          <SevIcon className={`w-3 h-3 ${sev.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-black uppercase tracking-wide ${actionColor(event.action)}`}>
              {event.action.replace(/_/g, ' ')}
            </span>
            {event.userId && (
              <span className="text-[10px] font-bold text-muted bg-stone px-1.5 py-0.5 rounded" title={event.userId}>
                {displayName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-muted font-medium" title={formatTime(event.timestamp)}>
              <Clock className="inline w-2.5 h-2.5 mr-0.5 -mt-0.5" />
              {timeAgo(event.timestamp)} · {formatTime(event.timestamp)}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {details && (
          <button className="shrink-0 text-muted hover:text-ink transition-colors p-1 rounded">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && details && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-3"
        >
          <pre className="text-[10px] bg-stone rounded-xl p-3 overflow-x-auto font-mono text-ink/70 max-h-48 leading-relaxed border border-dawn">
            {details}
          </pre>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── ActivityFeed (main) ───────────────────────────────────────────────────────
const SEVERITIES = ['all', 'info', 'warning', 'error', 'critical'] as const;
const PAGE_SIZE = 50;

export default function ActivityFeed() {
  // Read auditLogs DIRECTLY from context — this is live-reactive state,
  // not a snapshot. exportWorkspace() would return stale data.
  const { auditLogs, users, isMasterAdmin, logAction } = useLocalData();

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('all');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Guard must come AFTER hooks (Rules of Hooks)
  if (!isMasterAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <Shield className="w-12 h-12 text-red-400" />
        <p className="font-bold text-ink">Access restricted to Master Admin only.</p>
      </div>
    );
  }

  const allLogs = auditLogs ?? [];

  const filtered = useMemo(() => {
    return allLogs.filter(e => {
      const matchSev = severity === 'all' || (e.severity || 'info') === severity;
      const q = search.toLowerCase();
      const matchSearch = !q
        || e.action.toLowerCase().includes(q)
        || (e.userId || '').toLowerCase().includes(q)
        || JSON.stringify(e.details).toLowerCase().includes(q);
      return matchSev && matchSearch;
    });
  }, [allLogs, severity, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleExportCSV = () => {
    const rows = filtered.map(e => [e.id, e.action, e.userId ?? '', e.severity ?? 'info', e.timestamp, JSON.stringify(e.details)]);
    const csv = ['ID,Action,User,Severity,Timestamp,Details', ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trygc-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAction('EXPORT_AUDIT_CSV', { count: filtered.length });
    addToast(`${filtered.length} events exported.`, 'success', 3000);
  };

  // Severity counts
  const counts = SEVERITIES.slice(1).reduce((acc, s) => {
    acc[s] = allLogs.filter(e => (e.severity || 'info') === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-ink rounded-2xl shadow-lg shadow-ink/10">
              <Activity className="w-5 h-5 text-citrus" />
            </div>
            <div>
              <h2 className="relaxed-title text-2xl">Activity Feed</h2>
              <p className="text-xs font-bold text-muted">Real-time audit log of all workspace events</p>
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
            {(search || severity !== 'all') && <span className="w-2 h-2 rounded-full bg-citrus" />}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink/90 transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Severity summary pills */}
      <div className="flex flex-wrap gap-2">
        {SEVERITIES.map(s => {
          const meta = s === 'all' ? { color: 'text-ink', bg: 'bg-stone', label: 'All', icon: Activity } : SEVERITY_META[s];
          const Icon = meta.icon;
          const count = s === 'all' ? allLogs.length : (counts[s] ?? 0);
          const isActive = severity === s;
          return (
            <button
              key={s}
              onClick={() => { setSeverity(s); setPage(0); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                isActive ? 'bg-ink text-white border-ink' : `border-dawn ${meta.bg} ${meta.color} hover:border-ink`
              }`}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
              <span className={`ml-0.5 px-1 py-0.5 rounded text-[9px] ${isActive ? 'bg-white/20' : 'bg-ink/10'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-white border border-dawn rounded-2xl shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted">Search Events</span>
            <button onClick={() => setShowFilters(false)} className="p-1 text-muted hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by action, user or detail..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone/40 border border-dawn rounded-xl text-xs font-medium focus:border-citrus focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Event list */}
      <div className="bg-white border border-dawn rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-dawn flex items-center justify-between bg-stone/20">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">
            {filtered.length.toLocaleString()} event{filtered.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </span>
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="text-[9px] font-bold text-citrus hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-sm font-bold">No events found</p>
            <p className="text-[10px] font-medium">Try changing the filters or search term</p>
          </div>
        ) : (
          <div>
            {paginated.map((event, idx) => (
              <EventRow key={event.id} event={event} idx={idx} users={users} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dawn bg-stone/10">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-dawn disabled:opacity-30 hover:bg-stone transition-colors"
            >
              Previous
            </button>
            <span className="text-[10px] font-bold text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-dawn disabled:opacity-30 hover:bg-stone transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Live pulse indicator */}
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted/50">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Live · {allLogs.length} total events stored · last updated {allLogs[0] ? timeAgo(allLogs[0].timestamp) : 'never'}
      </div>
    </div>
  );
}
