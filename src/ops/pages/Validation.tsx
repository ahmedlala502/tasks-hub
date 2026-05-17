import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  Filter,
  MessageSquare,
  MoreVertical,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '../utils';
import { dataService } from '../services/dataService';

type ValidationStatus = 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Fix Required';
type ValidationPriority = 'High' | 'Standard';
type ValidationItem = {
  id: string;
  influencerId?: string;
  campaign: string;
  creator: string;
  type: string;
  submitted: string;
  priority: ValidationPriority;
  status: ValidationStatus;
  notes: string;
};

const STORAGE_KEY = 'trygc-validation-queue';

const FALLBACK_QUEUE: ValidationItem[] = [
  { id: 'VAL-101', campaign: 'Red Bull Summer', creator: '@tech_omar', type: 'Visit Proof', submitted: '12m ago', priority: 'High', status: 'Pending', notes: 'Confirm timestamp and venue match.' },
  { id: 'VAL-102', campaign: 'STC Pay Launch', creator: '@fashion.mona', type: 'Draft Video', submitted: '2h ago', priority: 'Standard', status: 'In Review', notes: 'Check caption and mandatory app mention.' },
  { id: 'VAL-103', campaign: 'Almarai Fresh', creator: '@riyadh_explorer', type: 'Final Post', submitted: '5h ago', priority: 'Standard', status: 'Approved', notes: 'All metadata aligned.' },
  { id: 'VAL-104', campaign: 'Hungerstation EGY', creator: '@lifestyle_sa', type: 'Agreement', submitted: '1d ago', priority: 'High', status: 'Rejected', notes: 'Missing signed rate card.' },
];

function buildInitialQueue(): ValidationItem[] {
  if (typeof window === 'undefined') return FALLBACK_QUEUE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const campaigns = dataService.getCampaigns();
  const campaignName = (id: string) => campaigns.find(campaign => campaign.id === id)?.name || id || 'Unassigned Campaign';
  const influencerQueue = dataService.getInfluencers().map((influencer, index): ValidationItem => ({
    id: `VAL-${influencer.id}`,
    influencerId: influencer.id,
    campaign: campaignName(influencer.campaignId),
    creator: influencer.username,
    type: influencer.coverageReceived ? 'Final Post' : influencer.visitCompleted ? 'Visit Proof' : 'Creator Intake',
    submitted: index === 0 ? '12m ago' : `${index + 1}h ago`,
    priority: influencer.qaStatus === 'Fix Required' || !influencer.coverageReceived ? 'High' : 'Standard',
    status: influencer.qaStatus === 'Pending' ? 'Pending' : influencer.qaStatus === 'Fix Required' ? 'Fix Required' : influencer.qaStatus,
    notes: influencer.notes || 'Ready for validation review.',
  }));

  return influencerQueue.length ? influencerQueue : FALLBACK_QUEUE;
}

export default function Validation() {
  const [queue, setQueue] = React.useState<ValidationItem[]>(buildInitialQueue);
  const [query, setQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [selected, setSelected] = React.useState<ValidationItem | null>(null);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  const filteredQueue = queue.filter(item => {
    const haystack = `${item.campaign} ${item.creator} ${item.type} ${item.status}`.toLowerCase();
    const matchesSearch = haystack.includes(query.toLowerCase());
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'High Priority' && item.priority === 'High') ||
      (activeFilter === 'Drafts' && item.type.toLowerCase().includes('draft')) ||
      (activeFilter === 'Proofs' && item.type.toLowerCase().includes('proof'));
    return matchesSearch && matchesFilter;
  });

  const updateItem = (id: string, updates: Partial<ValidationItem>) => {
    setQueue(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      if (updated.influencerId && updates.status) {
        const qaStatus = updates.status === 'In Review' ? 'Pending' : updates.status === 'Fix Required' ? 'Fix Required' : updates.status;
        if (['Pending', 'Approved', 'Rejected', 'Fix Required'].includes(qaStatus)) {
          dataService.updateInfluencer(updated.influencerId, { qaStatus: qaStatus as any });
        }
      }
      return updated;
    }));
    setSelected(prev => (prev?.id === id ? { ...prev, ...updates } : prev));
  };

  const batchProcess = () => {
    setQueue(prev => prev.map(item => {
      if (item.status !== 'Pending' && item.status !== 'In Review') return item;
      if (item.influencerId) dataService.updateInfluencer(item.influencerId, { qaStatus: 'Approved' });
      return { ...item, status: 'Approved' as ValidationStatus, notes: item.notes || 'Batch approved by validation hub.' };
    }));
  };

  const pendingCount = queue.filter(item => item.status === 'Pending' || item.status === 'In Review').length;
  const approvedCount = queue.filter(item => item.status === 'Approved').length;
  const highPriorityCount = queue.filter(item => item.priority === 'High' && item.status !== 'Approved').length;
  const sla = Math.round((approvedCount / Math.max(queue.length, 1)) * 100);

  return (
    <div className="max-w-[1240px] mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-10">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Operational Integrity</div>
          <h1 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Validation Console</h1>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Review proof metadata, approve assets, reject issues, and log resolution notes.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Queue Integrity</span>
            <span className="text-2xl font-display font-black text-foreground tabular-nums tracking-tight">{sla}%</span>
          </div>
          <button onClick={batchProcess} className="px-6 py-3 bg-gc-orange text-white rounded-xl font-black uppercase text-[12px] tracking-widest shadow-lg shadow-gc-orange/20 hover:bg-gc-orange/90 transition-colors flex items-center gap-3">
            Batch Process <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <StatBox label="Pending Assets" value={pendingCount.toString()} color="orange" />
        <StatBox label="High Priority" value={highPriorityCount.toString()} color="red" />
        <StatBox label="Daily Clearance" value={approvedCount.toString()} color="success" />
        <StatBox label="SLA Compliance" value={`${sla}%`} color="slate" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border bg-secondary/20 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Scan queue..."
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="pl-12 pr-6 py-3 bg-card border border-border rounded-xl text-[12px] font-bold uppercase tracking-widest w-full lg:w-[280px] focus:outline-none focus:ring-[4px] focus:ring-gc-orange/10 focus:border-gc-orange shadow-sm transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['All', 'High Priority', 'Drafts', 'Proofs'].map(filter => (
                <button key={filter} onClick={() => setActiveFilter(filter)} className={cn(
                  'px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
                  activeFilter === filter
                    ? 'bg-gc-orange text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground shadow-sm',
                )}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Filter size={15} />
            {filteredQueue.length} Visible
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/20">
                <TableHead>Mission & Creator</TableHead>
                <TableHead>Asset Class</TableHead>
                <TableHead>Ingestion</TableHead>
                <TableHead>Security Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredQueue.map(item => (
                <tr key={item.id} className="group hover:bg-gc-orange/5 transition-all border-l-4 border-transparent hover:border-l-gc-orange">
                  <td className="px-5 py-5 pl-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:bg-gc-orange group-hover:text-white group-hover:border-gc-orange transition-all shadow-sm">
                        <FileCheck size={22} />
                      </div>
                      <div>
                        <p className="text-[14px] font-black text-foreground group-hover:text-gc-orange transition-colors">{item.campaign}</p>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{item.creator}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-2">
                      <select
                        value={item.type}
                        onChange={event => updateItem(item.id, { type: event.target.value })}
                        className="text-[11px] font-black text-foreground uppercase tracking-widest px-3.5 py-1.5 bg-secondary border border-border rounded-full shadow-sm outline-none"
                      >
                        {['Creator Intake', 'Visit Proof', 'Draft Video', 'Final Post', 'Agreement'].map(type => <option key={type}>{type}</option>)}
                      </select>
                      {item.priority === 'High' && <AlertCircle size={16} className="text-red-500" />}
                    </div>
                  </td>
                  <td className="px-5 py-5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest tabular-nums italic">{item.submitted}</td>
                  <td className="px-5 py-5">
                    <StatusSelect status={item.status} onChange={status => updateItem(item.id, { status })} />
                  </td>
                  <td className="px-5 py-5 pr-8">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelected(item)} className="icon-btn" title="Open review">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => updateItem(item.id, { status: 'Approved' })} className="icon-btn text-emerald-600" title="Approve">
                        <CheckCircle2 size={18} />
                      </button>
                      <button onClick={() => updateItem(item.id, { status: 'Fix Required' })} className="icon-btn text-gc-orange" title="Request fix">
                        <MessageSquare size={18} />
                      </button>
                      <button onClick={() => updateItem(item.id, { status: 'Rejected' })} className="icon-btn text-red-500" title="Reject">
                        <XCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredQueue.length === 0 && (
            <div className="p-16 text-center text-sm font-semibold text-muted-foreground">No validation assets match the current filters.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Validation Review</p>
                <h3 className="font-condensed text-[20px] font-extrabold text-foreground">{selected.creator}</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{selected.campaign} / {selected.type}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><X size={15} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Status</span>
                <StatusSelect status={selected.status} onChange={status => updateItem(selected.id, { status })} wide />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Priority</span>
                <select className="settings-input" value={selected.priority} onChange={event => updateItem(selected.id, { priority: event.target.value as ValidationPriority })}>
                  {['High', 'Standard'].map(priority => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="md:col-span-2 space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Review Notes</span>
                <textarea className="settings-input min-h-[130px]" value={selected.notes} onChange={event => updateItem(selected.id, { notes: event.target.value })} />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => updateItem(selected.id, { status: 'Rejected' })} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100">Reject</button>
              <button onClick={() => updateItem(selected.id, { status: 'Fix Required' })} className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-gc-orange hover:bg-orange-100">Request Fix</button>
              <button onClick={() => updateItem(selected.id, { status: 'Approved' })} className="rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableHead({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={cn(
      'px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border',
      align === 'right' ? 'text-right pr-8' : 'text-left',
    )}>
      {children}
    </th>
  );
}

function StatusSelect({ status, onChange, wide }: { status: ValidationStatus; onChange: (status: ValidationStatus) => void; wide?: boolean }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-sm', statusClass(status), wide && 'w-full rounded-lg')}>
      {status === 'Approved' ? <CheckCircle2 size={14} strokeWidth={2.5} /> : status === 'In Review' ? <Clock size={14} strokeWidth={2.5} /> : status === 'Rejected' ? <XCircle size={14} strokeWidth={2.5} /> : <ShieldCheck size={14} strokeWidth={2.5} />}
      <select value={status} onChange={event => onChange(event.target.value as ValidationStatus)} className="bg-transparent outline-none text-[11px] font-black uppercase tracking-widest">
        {['Pending', 'In Review', 'Approved', 'Rejected', 'Fix Required'].map(option => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}

function statusClass(status: ValidationStatus) {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (status === 'In Review') return 'bg-amber-50 text-amber-600 border-amber-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-600 border-red-200';
  if (status === 'Fix Required') return 'bg-orange-50 text-gc-orange border-orange-200';
  return 'bg-secondary text-muted-foreground border-border';
}

function StatBox({ label, value, color }: { label: string; value: string; color: 'orange' | 'red' | 'success' | 'slate' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-gc-orange/30 transition-all shadow-sm">
      <div className={cn(
        'absolute -bottom-6 -right-6 size-28 transition-transform duration-700 group-hover:scale-125 opacity-20',
        color === 'orange' && 'text-gc-orange',
        color === 'red' && 'text-red-500',
        color === 'success' && 'text-emerald-500',
        color === 'slate' && 'text-muted-foreground',
      )}>
        <FileCheck size={110} strokeWidth={1} />
      </div>
      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2 relative z-10">{label}</p>
      <p className={cn(
        'text-4xl font-display font-black tracking-tight relative z-10',
        color === 'orange' && 'text-gc-orange',
        color === 'red' && 'text-red-500',
        color === 'success' && 'text-emerald-600',
        color === 'slate' && 'text-foreground',
      )}>{value}</p>
    </div>
  );
}
