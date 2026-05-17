import React from 'react';
import { Office, Task, Handover, Priority, Status } from '../../types';
import { AlertCircle, ArrowRight, Zap, TrendingUp, Clock, Layout, CheckSquare, Globe, RefreshCw, ChevronRight, User, MapPin, CheckCircle, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { COUNTRY_FLAGS } from '../../constants';
import { useLocalData } from '../LocalDataContext';

interface DashboardProps {
  tasks: Task[];
  handovers: Handover[];
  offices: Office[];
  stats: {
    openCount: number;
    riskCount: number;
    carryCount: number;
    handoverCount: number;
  };
  onActionRisks?: () => void;
  onGenerateBrief?: () => void;
  onNavigate?: (tab: string, filter?: string, status?: string) => void;
}

export default function Dashboard({ tasks, handovers, offices, stats, onActionRisks, onGenerateBrief, onNavigate }: DashboardProps) {
  const { isWidgetEnabled, isMasterAdmin, importData, logAction } = useLocalData();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const highRiskTasks = [...tasks]
    .filter(t => t.status !== Status.DONE && (t.priority === Priority.HIGH || t.status === Status.BLOCKED))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    .slice(0, 5);

  const acknowledgedCount = handovers.filter(h => h.status === 'Acknowledged').length;

  return (
    <div className="space-y-10 pb-20">
      {/* Hero Rhythm Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card relative overflow-hidden group border-none bg-gradient-to-br from-ink to-slate-900 text-white p-10">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-citrus text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-6 shadow-lg shadow-citrus/20">
              <Zap className="w-3 h-3" />
              <span>Live Operating Pulse</span>
            </div>
            <h2 className="relaxed-title text-5xl mb-6 max-w-lg leading-[1.1]">The regional pulse is active, Ahmed.</h2>
            <p className="text-white/70 font-medium mb-10 max-w-xl leading-relaxed text-lg">
              There are <span className="text-white font-bold">{stats.openCount} open outcomes</span> across 7 active territories. 
              Review the <span className="text-citrus font-bold">{stats.riskCount} high-sensitivity alerts</span> before handover initiation.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <button onClick={onActionRisks} className="px-8 py-3 bg-citrus text-ink rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.05] transition-all shadow-xl shadow-citrus/20">
                Action Risks
              </button>
              <button onClick={onGenerateBrief} className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                Generate Brief
              </button>
              {isMasterAdmin && (
                <>
                  <input 
                    type="file" 
                    accept=".json" 
                    className="hidden" 
                    ref={fileRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImporting(true);
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        if (importData(text)) {
                          logAction('IMPORT_WORKSPACE_JSON', { source: 'dashboard' });
                          setTimeout(() => window.location.reload(), 500); // hard reload to reflect new data
                        }
                        setImporting(false);
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                  <button 
                    disabled={importing}
                    onClick={() => fileRef.current?.click()} 
                    className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {importing ? 'Uploading...' : 'Bulk Upload'}
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="absolute right-[-40px] bottom-[-40px] opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
            <Layout className="w-[400px] h-[400px]" />
          </div>
        </div>

        {isWidgetEnabled('workspaceHealth') && (
        <div className="glass-card flex flex-col justify-between p-8 border-dawn">
          <div>
            <div className="flex justify-between items-start mb-8">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-2">Workspace Health</span>
                <span className="relaxed-title text-4xl">84%</span>
              </div>
              <div className="p-3 bg-green-50 rounded-2xl shadow-inner">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2.5">
                  <span className="text-muted">Target Velocity</span>
                  <span className="text-ink">142 / 168 outcomes</span>
                </div>
                <div className="h-3 bg-stone rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "84%" }}
                    className="h-full bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-stone/50 rounded-2xl border border-dawn">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Efficiency</span>
                    <span className="text-sm font-bold text-ink">+12%</span>
                 </div>
                 <div className="p-4 bg-stone/50 rounded-2xl border border-dawn">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-muted mb-1">Response</span>
                    <span className="text-sm font-bold text-ink">4.2m</span>
                 </div>
              </div>
            </div>
          </div>
          
          <p className="text-[9px] font-bold text-muted/60 leading-relaxed uppercase tracking-tighter mt-8 flex items-center gap-2 border-t border-dawn pt-4">
            <RefreshCw className="w-3 h-3 animate-spin-slow" />
            Synced with Cairo HQ Operations Node.
          </p>
        </div>
        )}
      </section>

      {/* KPI Stats Row */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {[
          { label: 'Open Outcomes', val: stats.openCount, note: 'Daily pending', icon: CheckSquare, action: () => onNavigate?.('tasks', '', 'All') },
          { label: 'Critical Risks', val: stats.riskCount, note: 'SLA pressure', icon: AlertCircle, color: 'text-red-500', action: () => onNavigate?.('tasks', 'risk') },
          { label: 'Carry-over', val: stats.carryCount, note: 'Multi-shift', icon: RefreshCw, color: 'text-citrus', action: () => onNavigate?.('tasks', 'carry') },
          { label: 'Handovers', val: stats.handoverCount, note: 'Active sync', icon: Globe, color: 'text-blue-500', action: () => onNavigate?.('handover') },
          { label: 'Acknowledged', val: acknowledgedCount, note: 'Confirmed received', icon: CheckCircle, color: 'text-green-500', action: () => onNavigate?.('handover') },
        ].map((kpi, i) => (
          <button key={i} onClick={kpi.action} className="glass-card p-6 border-dawn hover:border-citrus/20 transition-all group text-left">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted group-hover:text-ink transition-colors">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color || 'text-muted'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="relaxed-title text-3xl font-black">{kpi.val}</span>
              <span className="text-[9px] font-bold text-muted/50 uppercase tracking-tighter">{kpi.note}</span>
            </div>
          </button>
        ))}
      </section>

      {/* Priority Queue & Shift Timeline */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {isWidgetEnabled('priorityQueue') && (
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="relaxed-title text-xl tracking-tight">Priority Outcome Queue</h3>
            </div>
            <button onClick={onActionRisks} className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-ink transition-colors border border-dawn px-4 py-1.5 rounded-lg">Audit All Risks</button>
          </div>
          
          <div className="glass-card p-0 overflow-hidden border-dawn shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone/50 border-b border-dawn">
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-muted">Core Task</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-muted">Sensitivity</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-muted">Owner</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.15em] text-muted">Commitment</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dawn">
                {highRiskTasks.map((task) => (
                   <tr key={task.id} onClick={() => onNavigate?.('tasks', task.title)} className="group hover:bg-stone/30 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-ink mb-0.5">{task.title}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">{task.office}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          task.status === Status.BLOCKED ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
                        }`}>
                          {task.status === Status.BLOCKED ? 'Blocked' : 'High Risk'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-dawn rounded-lg flex items-center justify-center text-[10px] font-black text-muted">
                            {task.owner.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-[10px] font-bold text-muted uppercase tracking-tighter">{task.owner}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-ink">{new Date(task.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-[9px] font-bold text-red-500/60 uppercase tracking-tighter">Overdue soon</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-dawn group-hover:text-ink transition-colors" />
                      </td>
                   </tr>
                ))}
                {highRiskTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-3">
                         <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                           <CheckCircle className="w-6 h-6 text-green-500" />
                         </div>
                         <span className="text-xs font-bold text-muted">Maximum stability achieved. No high-risk items.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {isWidgetEnabled('shiftTimeline') && (
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-citrus" />
              <h3 className="relaxed-title text-xl tracking-tight">Shift Timeline</h3>
            </div>
          </div>
          
          <div className="glass-card p-6 space-y-8 relative before:absolute before:left-10 before:top-10 before:bottom-10 before:w-[1px] before:bg-dawn">
            {handovers.slice(0, 5).map((ho) => (
              <button key={ho.id} onClick={() => onNavigate?.('handover')} className="relative pl-12 block w-full text-left">
                 <div className="absolute left-0 top-0 w-8 h-8 bg-white border border-dawn rounded-lg shadow-sm flex items-center justify-center z-10 transition-transform group-hover:scale-110">
                    <RefreshCw className={`w-4 h-4 ${ho.status === 'Pending' ? 'text-citrus animate-spin-slow' : 'text-green-500'}`} />
                 </div>
                 <div>
                    <div className="flex items-center justify-between mb-1.5">
                       <span className="text-[10px] font-black uppercase tracking-widest text-ink">{ho.fromShift} → {ho.toShift}</span>
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${
                         ho.status === 'Pending' ? 'bg-citrus/10 text-citrus border-citrus/20' : 'bg-green-50 text-green-600 border-green-100'
                       }`}>
                         {ho.status}
                       </span>
                    </div>
                    <p className="text-[11px] font-bold text-muted leading-relaxed line-clamp-1">
                      {ho.outgoing} → {ho.incoming} from {ho.fromOffice}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="text-[9px] font-bold text-muted/60">{new Date(ho.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="w-1 h-1 bg-dawn rounded-full" />
                       <span className="text-[9px] font-bold text-citrus uppercase tracking-widest">{ho.taskIds.length} Outcomes</span>
                    </div>
                 </div>
              </button>
            ))}
            {handovers.length === 0 && (
              <div className="py-10 text-center">
                 <p className="text-xs font-bold text-muted">No handover events recorded yet.</p>
              </div>
            )}
          </div>
        </div>
        )}
      </section>

      {/* Regional Office Grid */}
      {isWidgetEnabled('operatingHubs') && (
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-500" />
            <h3 className="relaxed-title text-xl tracking-tight">Active Operating Hubs</h3>
          </div>
          <button onClick={() => onNavigate?.('offices')} className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-ink transition-colors">Global Connectivity</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {offices.map(office => {
            const officeTasks = tasks.filter(t => t.office === office.name);
            const openTasks = officeTasks.filter(t => t.status !== Status.DONE);
            const riskTasks = officeTasks.filter(t => t.priority === Priority.HIGH && t.status !== Status.DONE);
            const progress = officeTasks.length > 0 ? (officeTasks.filter(t => t.status === Status.DONE).length / officeTasks.length) * 100 : 0;
            
            return (
              <button key={office.id} onClick={() => onNavigate?.('tasks', office.name)} className="glass-card p-6 border-dawn hover:border-citrus/20 hover:shadow-lg transition-all group overflow-hidden text-left">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{COUNTRY_FLAGS[office.country] || '🌍'}</span>
                    <div>
                      <span className="block text-xs font-black uppercase tracking-widest text-ink group-hover:text-citrus transition-colors">{office.name}</span>
                      <span className="text-[9px] font-bold text-muted uppercase tracking-tighter">{office.country}</span>
                    </div>
                  </div>
                  {riskTasks.length > 0 && (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </motion.div>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-stone rounded-lg flex items-center justify-center text-[9px] font-black text-muted border border-dawn">
                        {office.lead.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-[10px] font-bold text-muted">{office.lead}</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-citrus">{office.shift}</span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted">{openTasks.length} Pending</span>
                      <span className="text-[9px] font-black text-ink">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-stone rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full transition-colors ${riskTasks.length > 0 ? 'bg-red-500' : 'bg-citrus'}`}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="absolute right-[-10px] top-[-10px] opacity-[0.03] group-hover:rotate-12 transition-transform duration-500">
                  <MapPin className="w-24 h-24" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}
