import React from 'react';
import { Office, Task, Status } from '../../types';
import { MapPin, Users, Activity, ChevronRight, Zap } from 'lucide-react';

interface OfficeMapProps {
  offices: Office[];
  tasks: Task[];
}

export default function OfficeMap({ offices, tasks }: OfficeMapProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-8">
        {offices.map((office) => {
          const officeTasks = tasks.filter(t => t.office === office.name);
          const done = officeTasks.filter(t => t.status === Status.DONE).length;
          const total = officeTasks.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 100;

          return (
            <div key={office.id} className="glass-card flex items-stretch p-0 overflow-hidden group hover:border-citrus/30 transition-all duration-500">
              <div className="w-2/5 p-6 bg-stone/30 relative flex flex-col justify-between overflow-hidden">
                <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl leading-none">
                        {office.country === 'KSA' ? '🇸🇦' : 
                         office.country === 'UAE' ? '🇦🇪' : 
                         office.country === 'KW' ? '🇰🇼' : '🇪🇬'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{office.country}</span>
                   </div>
                   <h3 className="relaxed-title text-2xl group-hover:text-citrus transition-colors">{office.name}</h3>
                   <span className="block text-xs font-bold text-muted/60 mt-1">{office.lead} · {office.shift}</span>
                </div>
                
                <div className="relative z-10 flex items-center gap-4 text-muted">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black">Region Active</span>
                  </div>
                </div>

                <div className="absolute right-[-20px] top-[-20px] opacity-5 group-hover:scale-125 transition-transform duration-700 pointer-events-none">
                  <MapPin className="w-[180px] h-[180px]" />
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Core Workload</span>
                      <span className="relaxed-title text-3xl">{total} Tasks</span>
                   </div>
                   <div className="p-2 bg-citrus/5 text-citrus rounded-lg">
                      <Zap className="w-5 h-5" />
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-muted">Completion Pulse</span>
                      <span className="text-ink">{pct}%</span>
                   </div>
                   <div className="h-2 bg-dawn rounded-full overflow-hidden">
                      <div className="h-full bg-citrus rounded-full" style={{ width: `${pct}%` }} />
                   </div>
                   <div className="flex gap-4 pt-2">
                       <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                         <span className="text-[10px] font-black uppercase tracking-tighter text-muted">{done} Done</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 bg-dawn rounded-full" />
                         <span className="text-[10px] font-black uppercase tracking-tighter text-muted">{total - done} Pending</span>
                       </div>
                   </div>
                </div>

                <button className="w-full mt-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted border border-dawn rounded-xl hover:bg-ink hover:text-white hover:border-ink transition-all flex items-center justify-center gap-2">
                  <span>Enter Hub Workspace</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h3 className="relaxed-title text-xl">Regional Continuity Analysis</h3>
              <p className="text-sm text-muted font-medium mt-1">AI-driven assessment of resource distribution and shift overlap.</p>
           </div>
           <div className="flex gap-2">
              <span className="px-3 py-1 bg-ink text-white rounded-lg text-xs font-bold">Live Graph</span>
              <span className="px-3 py-1 bg-stone text-muted border border-dawn rounded-lg text-xs font-bold">Historical</span>
           </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
           {['Coverage Depth', 'Avg SLA Wait', 'Coordination Lift', 'Activation Rate'].map((m) => (
             <div key={m} className="p-4 border border-dawn rounded-2xl bg-stone/20">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-2">{m}</span>
                <div className="flex items-center justify-between">
                   <span className="relaxed-title text-2xl">{(Math.random() * 10 + 50).toFixed(1)}%</span>
                   <Activity className="w-4 h-4 text-citrus" />
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
