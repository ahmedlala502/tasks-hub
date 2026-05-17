/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HardDrive, Folder, FileText, ChevronRight, Search, Plus, Filter, ExternalLink } from 'lucide-react';

const INITIAL_REGISTRY = [
  { id: '1', brand: 'Red Bull', type: 'Active', country: 'KSA', date: '2024-04', size: '1.2 GB' },
  { id: '2', brand: 'STC Pay', type: 'Closed', country: 'UAE', date: '2024-03', size: '4.8 GB' },
  { id: '3', brand: 'Hungerstation', type: 'Ready', country: 'KSA', date: '2024-05', size: '512 MB' },
];

export default function AssetRegistry() {
  const [registry, setRegistry] = React.useState(INITIAL_REGISTRY);
  const [syncMessage, setSyncMessage] = React.useState('');

  const syncPCloud = () => {
    const next = {
      id: `asset-${Date.now()}`,
      brand: 'New Sync Folder',
      type: 'Ready',
      country: 'KSA',
      date: new Date().toISOString().slice(0, 7),
      size: '0 MB',
    };
    setRegistry(prev => [next, ...prev]);
    setSyncMessage('New PCloud sync folder created.');
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-10">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Data Warehouse</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Asset Registry</h2>
          <p className="text-[var(--ink-700)] flex items-center gap-2 mt-2 font-mono text-[13px]">
            <HardDrive size={16} className="text-[var(--gc-orange)]" />
            PCloud Protocol Archive & Evidence Storage.
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={syncPCloud} className="flex items-center gap-2 px-6 py-3 bg-gc-orange text-white text-[12px] font-display font-black uppercase tracking-widest rounded-xl hover:bg-gc-orange/90 shadow-md transition-all">
             <Plus size={16} /> Sync PCloud
           </button>
        </div>
      </div>
      {syncMessage && <div className="rounded-xl border border-gc-orange/20 bg-gc-orange/10 px-4 py-3 text-sm font-bold text-gc-orange">{syncMessage}</div>}

      <div className="bg-card border border-border rounded-xl overflow-hidden p-6 bg-[var(--bg)] flex items-center justify-between">
         <div className="relative w-[380px]">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-300)]" />
           <input className="w-full pl-12 pr-4 py-3 text-sm outline-none font-medium bg-[var(--white)] border border-[var(--border)] rounded-full focus:border-[var(--gc-purple)] focus:ring-[4px] focus:ring-[var(--gc-purple-mid)] transition-all" placeholder="Search Brand, Market or Campaign Reference..." />
         </div>
         <button className="flex items-center gap-2 px-5 py-3 border border-[var(--border)] rounded-full text-[12px] font-display font-bold uppercase tracking-widest text-[var(--ink-700)] bg-[var(--white)] hover:bg-[var(--bg)] hover:border-[var(--border-strong)] transition-all">
            <Filter size={16} /> Filter
         </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden bg-[var(--white)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Directory Path</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Region</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Retention</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Size</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border text-right">Access</th>
              </tr>
            </thead>
            <tbody>
              {registry.map((item) => (
                <tr key={item.id} className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors group hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all cursor-default bg-[var(--white)] z-0 hover:z-10 relative">
                  <td className="px-6 py-5 border-b border-[var(--border)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Folder size={18} />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-[var(--ink-900)] leading-tight">{item.brand}</p>
                        <p className="text-[11px] text-[var(--ink-500)] font-mono mt-1">/Active_Campaigns/{item.brand.replace(' ', '_')}/{item.date}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-b border-[var(--border)]">
                     <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--gc-orange-soft)] text-[var(--gc-orange)]">{item.country}</span>
                  </td>
                  <td className="px-6 py-5 border-b border-[var(--border)]">
                     <span className="text-[12px] font-bold text-[var(--ink-700)]">{item.type}</span>
                  </td>
                  <td className="px-6 py-5 border-b border-[var(--border)] font-mono text-[12px] text-[var(--ink-500)]">
                    {item.size}
                  </td>
                  <td className="px-6 py-5 border-b border-[var(--border)] text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2.5 text-[var(--ink-300)] hover:text-[var(--gc-purple)] hover:bg-[var(--gc-purple-soft)] rounded-md transition-all shadow-sm shadow-transparent hover:shadow-[var(--shadow-sm)]">
                        <ExternalLink size={18} />
                      </button>
                    </div>
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
