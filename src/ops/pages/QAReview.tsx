/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MoreVertical,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Zap,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { cn } from '../utils';

const MOCK_QA_QUEUE = [
  { id: 'QA-501', influencer: 'tech_omar', campaign: 'Red Bull Summer KSA', link: 'https://tiktok.com/@tech_omar/video/123', receivedAt: '10m ago', status: 'Pending', type: 'Story x2' },
  { id: 'QA-502', influencer: 'riyadh_fashion', campaign: 'STC Pay Launch', link: 'https://instagram.com/p/456', receivedAt: '45m ago', status: 'Approved', type: 'Video x1' },
];

export default function QAReviewWorkspace() {
  const [queue, setQueue] = useState(MOCK_QA_QUEUE);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredQueue = queue.filter(item => 
    item.influencer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.campaign.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateStatus = (id: string, status: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-10">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Stage 16 Operations</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Quality Protocol</h2>
          <p className="text-[var(--ink-700)] flex items-center gap-2 mt-2 font-mono text-[13px]">
            <ShieldCheck size={16} className="text-[var(--gc-purple)]" />
            Verifying posting compliance across active coverage streams.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 border border-[var(--border)] rounded-full text-[12px] font-display font-black uppercase tracking-widest text-[var(--ink-500)] bg-[var(--white)] hover:bg-[var(--bg)] hover:border-[var(--border-strong)] transition-all">
            Batch Approval
          </button>
          <button className="bg-gc-orange text-white px-4 py-2.5 rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors flex items-center gap-2">
            <Zap size={18} /> Forced Compliance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredQueue.map((item) => (
          <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col group overflow-hidden bg-[var(--bg)]">
            <div className={cn(
              "p-5 border-b border-[var(--border)] flex justify-between items-center transition-colors shadow-sm",
              item.status === 'Approved' ? "bg-[var(--success)]/10" : "bg-[var(--white)]"
            )}>
               <div className="flex items-center gap-3">
                 <span className="text-[11px] font-mono font-bold text-[var(--ink-500)] bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1 rounded uppercase tracking-wider">{item.id}</span>
                 <input 
                   className="text-[14px] font-bold text-[var(--ink-900)] bg-transparent outline-none border-none focus:ring-[2px] focus:ring-[var(--gc-purple-soft)] rounded px-2 -mx-2 transition-all"
                   value={item.influencer}
                   onChange={(e) => {
                     setQueue(prev => prev.map(i => i.id === item.id ? { ...i, influencer: e.target.value } : i));
                   }}
                 />
               </div>
               <div className={cn(
                 "text-[10.5px] font-display font-black uppercase tracking-[1.5px] px-3.5 py-1 rounded-full border",
                 item.status === 'Approved' ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-amber-50 text-amber-600 border-amber-200"
               )}>
                 {item.status}
               </div>
            </div>
            
            <div className="p-8 space-y-6 flex-1 bg-[var(--white)]">
               <div className="space-y-2">
                 <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Campaign Context</p>
                 <input 
                   className="text-[16px] font-bold text-[var(--ink-900)] bg-transparent border-none outline-none focus:ring-[2px] focus:ring-[var(--gc-purple-soft)] rounded px-2 -mx-2 w-full transition-all"
                   value={item.campaign}
                   onChange={(e) => {
                     setQueue(prev => prev.map(i => i.id === item.id ? { ...i, campaign: e.target.value } : i));
                   }}
                 />
               </div>

               <div className="p-5 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex justify-between items-center hover:border-[var(--gc-purple-soft)] transition-colors group/link cursor-pointer shadow-sm">
                 <div className="flex items-center gap-3 text-[var(--gc-purple)] font-medium">
                   <ExternalLink size={18} className="group-hover/link:scale-110 transition-transform" />
                   <span className="text-[14px] border-b border-[var(--gc-purple)]/30 font-bold hover:border-[var(--gc-purple)] transition-colors">Review Posting Coverage</span>
                 </div>
                 <p className="text-[11px] font-mono text-[var(--ink-500)] uppercase tracking-wider">Received {item.receivedAt}</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <QACheck label="Tags Checked" checked={true} />
                  <QACheck label="Mentions Checked" checked={true} />
                  <QACheck label="Links Checked" checked={false} />
                  <QACheck label="Timing Opt." checked={true} />
               </div>
            </div>

            <div className="p-5 bg-[var(--bg)] border-t border-[var(--border)] grid grid-cols-2 gap-4">
               <button 
                  onClick={() => handleUpdateStatus(item.id, 'Fix Required')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[11.5px] font-display font-black uppercase tracking-[1px] text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:border-[rgba(180,35,24,0.2)] transition-all shadow-sm"
               >
                 <ThumbsDown size={18} />
                 Signal Fix
               </button>
               <button 
                  onClick={() => handleUpdateStatus(item.id, 'Approved')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-[var(--gc-purple)] text-white rounded-xl text-[11.5px] font-display font-black uppercase tracking-[1px] hover:opacity-90 transition-all shadow-[var(--shadow-sm)]"
               >
                 <ThumbsUp size={18} />
                 Pass Review
               </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden p-8 border-l-[6px] border-l-[var(--gc-orange)] bg-[var(--bg)] shadow-[var(--shadow-sm)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex gap-6">
          <div className="w-14 h-14 rounded-2xl bg-[var(--gc-orange-soft)] text-[var(--gc-orange)] flex items-center justify-center shrink-0 border border-[var(--gc-orange-mid)] shadow-sm">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h4 className="font-display font-black uppercase text-[15px] tracking-widest text-[var(--ink-900)]">Quality Assurance Active</h4>
            <p className="text-[14px] text-[var(--ink-700)] max-w-2xl mt-1.5 leading-relaxed font-sans">
              Verify all "Posting Coverage" against operational briefs. Identify missing mentions or broken links before finalizing verification.
            </p>
          </div>
        </div>
        <div className="flex gap-10 bg-[var(--white)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm">
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Pass Rate</p>
              <p className="text-3xl font-display font-black text-[var(--success)]">98.2%</p>
           </div>
           <div className="w-px bg-[var(--border)]" />
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Velocity</p>
              <p className="text-3xl font-display font-black text-[var(--gc-purple)]">1.4m</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function QACheck({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-xl border text-[10.5px] font-display font-black uppercase tracking-[1px] transition-all",
      checked ? "bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]" : "bg-[var(--white)] border-[var(--border-strong)] text-[var(--ink-300)]"
    )}>
      {label}
      {checked ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
    </div>
  );
}
