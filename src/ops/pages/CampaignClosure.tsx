import React from 'react';
import { Archive, CheckCircle2, AlertTriangle, FileText, BarChart, HardDrive } from 'lucide-react';
import { ClosureOutcome } from '../constants';
import { cn } from '../utils';
import { exportCampaigns } from '../services/spreadsheetService';
import { dataService } from '../services/dataService';

export default function CampaignClosure() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-10">
        <div className="space-y-1">
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Stage 18 Lifecycle</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Campaign Closure</h2>
          <p className="text-[var(--ink-700)] text-[14px]">Final reconciliation and archive procedures.</p>
        </div>
        <div className="flex items-center gap-4">
          <select className="px-5 py-3 h-[46px] border border-[var(--border-strong)] rounded-xl text-[12px] bg-[var(--white)] font-bold text-[var(--ink-900)] outline-none focus:border-[var(--gc-purple)] focus:ring-[4px] focus:ring-[var(--gc-purple-soft)] transition-all shadow-sm">
            <option>{ClosureOutcome.COMPLETED}</option>
            <option>{ClosureOutcome.PARTIAL}</option>
            <option>{ClosureOutcome.CANCELLED}</option>
          </select>
          <button className="bg-gc-orange text-white px-4 py-2.5 rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors px-8 py-3.5 h-[46px] flex items-center gap-2 shadow-[var(--shadow-lg)] disabled:opacity-50">
            <Archive size={16} /> Terminate & Archive
          </button>
        </div>
      </div>

      <div className="bg-[var(--white)] rounded-2xl border-2 border-[var(--danger)] shadow-sm overflow-hidden">
        <div className="bg-[var(--danger-soft)] p-5 border-b border-[var(--danger-soft)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--white)] text-[var(--danger)] flex items-center justify-center shadow-sm">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <h3 className="text-[13px] font-black text-[var(--danger)] uppercase tracking-widest">System Locked: Closure Conditions Incomplete</h3>
        </div>
        <div className="p-8 space-y-5">
           {[
             { label: 'Posting Coverage Reconciled', status: 'Incomplete', detail: '3 records still pending recovery status.' },
             { label: 'QA Review Completed', status: 'Complete', detail: 'All 68 received posts have been verified.' },
             { label: 'Client Reporting Uploaded', status: 'Incomplete', detail: 'Final report has not been detected in MOM folder.' },
             { label: 'Lessons Learned Documented', status: 'Incomplete', detail: 'Root Cause / Action Plan log is missing 2 entries.' }
           ].map((cond, i) => (
             <div key={i} className="flex gap-4 items-start border-b border-[var(--border)] pb-5 last:border-0 last:pb-0">
                <div className={cn(
                  "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                  cond.status === 'Complete' ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20"
                )}>
                  {cond.status === 'Complete' ? <CheckCircle2 size={16} strokeWidth={3} /> : <div className="w-2 h-2 bg-[var(--danger)] rounded-full" />}
                </div>
                <div>
                   <p className={cn(
                     "text-[14px] font-bold",
                     cond.status === 'Complete' ? 'text-[var(--ink-900)]' : 'text-[var(--danger)]/90'
                   )}>{cond.label}</p>
                   <p className="text-[12px] text-[var(--ink-500)] mt-1 font-medium">{cond.detail}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="bg-card border border-border rounded-xl overflow-hidden p-8 flex flex-col items-center gap-4 bg-[var(--bg)] hover:bg-[var(--ink-100)] border border-[var(--border-strong)] hover:border-[var(--gc-purple)] transition-all group shadow-sm text-[var(--ink-400)] hover:text-[var(--gc-purple)]">
          <FileText size={36} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
          <p className="text-[12px] font-black uppercase tracking-widest group-hover:text-[var(--gc-purple)]">Draft Report</p>
        </button>
        <button onClick={() => exportCampaigns(dataService.getCampaigns())} className="bg-card border border-border rounded-xl overflow-hidden p-8 flex flex-col items-center gap-4 bg-[var(--bg)] hover:bg-[var(--ink-100)] border border-[var(--border-strong)] hover:border-[var(--gc-purple)] transition-all group shadow-sm text-[var(--ink-400)] hover:text-[var(--gc-purple)]">
          <BarChart size={36} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
          <p className="text-[12px] font-black uppercase tracking-widest group-hover:text-[var(--gc-purple)]">Export Final KPIs</p>
        </button>
        <button className="bg-card border border-border rounded-xl overflow-hidden p-8 flex flex-col items-center gap-4 bg-[var(--bg)] hover:bg-[var(--ink-100)] border border-[var(--border-strong)] hover:border-[var(--gc-purple)] transition-all group shadow-sm text-[var(--ink-400)] hover:text-[var(--gc-purple)]">
          <HardDrive size={36} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
          <p className="text-[12px] font-black uppercase tracking-widest group-hover:text-[var(--gc-purple)]">Sync Asset Mirror</p>
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden p-8 bg-[var(--bg)] border border-[var(--border)]">
        <div className="pb-4 border-b border-[var(--border)] mb-5">
           <h4 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground text-[13px] tracking-widest">Post-Campaign Analysis (Lessons Learned)</h4>
        </div>
        <textarea 
          className="w-full min-h-[140px] px-5 py-4 border border-[var(--border-strong)] rounded-xl text-[14px] font-medium placeholder:text-[var(--ink-300)] bg-[var(--white)] focus:ring-[4px] focus:ring-[var(--gc-purple-soft)] focus:border-[var(--gc-purple)] outline-none transition-all shadow-sm"
          placeholder="Document operational blockers, influencer behavior, and recommendations for future campaigns with this client..."
        />
        <div className="mt-4 flex justify-end">
          <button className="px-6 py-2.5 bg-[var(--white)] border border-[var(--border-strong)] rounded-xl text-[12px] font-bold text-[var(--ink-700)] hover:bg-[var(--ink-100)] transition-all shadow-sm">
            Save Draft
          </button>
        </div>
      </div>
    </div>
  );
}
