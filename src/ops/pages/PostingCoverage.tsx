/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink, CheckCircle, AlertCircle, ShieldCheck, MailWarning, Ghost } from 'lucide-react';

const COVERAGE_DATA = [
  { 
    influencer: 'sarah_lifestyle', 
    platform: 'Instagram', 
    link: 'https://instagram.com/p/C_abc123', 
    tags: true, 
    mentions: true, 
    links: true, 
    compliance: 'Pass', 
    qa: 'QA Complete',
    recovery: 'N/A'
  },
  { 
    influencer: 'tech_omar', 
    platform: 'TikTok', 
    link: '', 
    tags: false, 
    mentions: false, 
    links: false, 
    compliance: 'N/A', 
    qa: 'Pending',
    recovery: 'Overdue - Phase 1'
  },
  { 
    influencer: 'riyadh_foodie', 
    platform: 'Instagram', 
    link: 'https://instagram.com/p/C_def456', 
    tags: true, 
    mentions: false, 
    links: true, 
    compliance: 'Fix Required', 
    qa: 'Failed',
    recovery: 'Contacting...'
  },
];

export default function PostingCoverageDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Posting Coverage Dashboard</h2>
          <p className="text-muted-foreground text-sm italic">"A task is not done until it is brief-compliant and QA-complete."</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
             <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 text-[var(--accent)] font-bold">Total Target</p>
             <p className="text-2xl font-bold font-mono">100</p>
          </div>
          <div className="text-right border-l border-border pl-4">
             <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 text-[var(--success)] font-bold">Received</p>
             <p className="text-2xl font-bold font-mono">68</p>
          </div>
          <div className="text-right border-l border-border pl-4">
             <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 text-[var(--critical)] font-bold">Missing</p>
             <p className="text-2xl font-bold font-mono">32</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: 'QA Pass Rate', value: '94%', icon: ShieldCheck, color: 'emerald' },
          { label: 'Avg Recovery Time', value: '4.2h', icon: MailWarning, color: 'amber' },
          { label: 'SLA Breach (24h)', value: '3', icon: AlertCircle, color: 'red' },
          { label: 'Expected Today', value: '12', icon: ExternalLink, color: 'blue' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl overflow-hidden p-4 flex items-center gap-4">
             <div className={`p-2 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-600`}>
               <kpi.icon size={20} />
             </div>
             <div>
               <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">{kpi.label}</p>
               <p className="text-lg font-bold font-mono">{kpi.value}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
          <h3 className="font-semibold text-sm">Active Coverage Recovery Workspace</h3>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700">3 Critically Missing</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-4">Influencer</th>
                <th className="px-6 py-4">Posting Coverage Link</th>
                <th className="px-6 py-4 text-center">T / M / L</th>
                <th className="px-6 py-4">QA Status</th>
                <th className="px-6 py-4">Recovery Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COVERAGE_DATA.map((item, idx) => (
                <tr key={idx} className="hover:bg-secondary/20">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Online" />
                      <span className="font-semibold">@{item.influencer}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.link ? (
                      <a href={item.link} className="text-[var(--accent)] hover:underline flex items-center gap-1">
                        <ExternalLink size={12} />
                        View Coverage
                      </a>
                    ) : (
                      <span className="text-red-500 font-bold flex items-center gap-1 font-mono text-[10px]">
                        <Ghost size={12} /> MISSING DATA
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1.5">
                      <Indicator active={item.tags} label="T" />
                      <Indicator active={item.mentions} label="M" />
                      <Indicator active={item.links} label="L" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.qa === 'QA Complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {item.qa}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[11px] font-medium text-slate-600">{item.recovery}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Indicator({ active, label }: { active: boolean, label: string }) {
  return (
    <div className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold border transition-all ${active ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-100 text-red-400'}`}>
      {label}
    </div>
  );
}
