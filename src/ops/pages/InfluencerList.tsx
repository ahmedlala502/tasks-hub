import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users,
  Search,
  UserPlus,
  Filter,
  LayoutGrid,
  List,
  CheckCircle2,
  ExternalLink,
  CheckSquare,
  Square,
  Trash2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  CalendarCheck,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../utils';
import { dataService } from '../services/dataService';
import { notify } from '../services/notificationService';
import { CampaignInfluencer } from '../types';
import { exportInfluencers, rowsToInfluencers } from '../services/spreadsheetService';
import { BulkUploadButton } from '../components/BulkUploadDialog';

export default function InfluencerList() {
  const navigate = useNavigate();
  const [influencers, setInfluencers] = useState<CampaignInfluencer[]>(dataService.getInfluencers());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CampaignInfluencer, direction: 'asc' | 'desc' } | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [isRecruitOpen, setIsRecruitOpen] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState({
    username: '@',
    platform: 'Instagram',
    status: 'Pending' as CampaignInfluencer['status'],
    city: 'Riyadh',
    country: 'Saudi Arabia',
    niche: 'Lifestyle',
    followerRange: '100k-500k',
    ownerId: 'Admin User',
    campaignId: 'C-001',
  });

  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [selectedRange, setSelectedRange] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const niches = useMemo(() => {
    const list = influencers.map(i => i.niche).filter(Boolean) as string[];
    return ['all', ...Array.from(new Set(list))];
  }, [influencers]);

  const ranges = ['all', '10k-50k', '50k-100k', '100k-500k', '500k-1M'];

  const filteredInfluencers = influencers.filter(inf => {
    const matchesSearch = inf.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inf.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inf.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesNiche = selectedNiche === 'all' || inf.niche === selectedNiche;
    const matchesRange = selectedRange === 'all' || inf.followerRange === selectedRange;

    return matchesSearch && matchesNiche && matchesRange;
  });

  const influencerSummary = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const todayStart = startOfToday.getTime();
    const todayEnd = endOfToday.getTime();

    return {
      scheduledToday: influencers.filter((inf) =>
        (inf.visitDate && inf.visitDate >= todayStart && inf.visitDate < todayEnd) ||
        (inf.status === 'Scheduled' && !inf.visitDate)
      ).length,
      approvalRequests: influencers.filter((inf) => inf.qaStatus === 'Pending' || inf.qaStatus === 'Fix Required').length,
      missedVisits: influencers.filter((inf) =>
        (inf.visitDate && inf.visitDate < todayStart && !inf.visitCompleted) ||
        inf.status === 'Dropped'
      ).length,
    };
  }, [influencers]);

  const sortedInfluencers = useMemo(() => {
    let sortableItems = [...filteredInfluencers];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = (a[sortConfig.key] || '').toString().toLowerCase();
        let bValue = (b[sortConfig.key] || '').toString().toLowerCase();
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredInfluencers, sortConfig]);

  const handleSort = (key: keyof CampaignInfluencer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleUpdateStatus = (id: string, status: CampaignInfluencer['status']) => {
    const updated = dataService.updateInfluencer(id, { status });
    setInfluencers(updated);
  };

  const handleUpdateCity = (id: string, city: string) => {
    const updated = dataService.updateInfluencer(id, { city });
    setInfluencers(updated);
  };

  const handleDelete = (id: string) => {
    const inf = influencers.find(i => i.id === id);
    setInfluencers(dataService.deleteInfluencer(id));
    setSelectedIds(prev => prev.filter(i => i !== id));
    if (inf) notify('Influencer Removed', `${inf.username} removed from roster`, 'red', '/influencers');
    setConfirmDeleteId(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedInfluencers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedInfluencers.map(i => i.id));
    }
  };

  const handleBulkStatusChange = (status: CampaignInfluencer['status']) => {
    setIsBulkUpdating(true);
    setTimeout(() => {
      const updated = dataService.bulkUpdateInfluencerStatus(selectedIds, status);
      setInfluencers(updated);
      setSelectedIds([]);
      setIsBulkUpdating(false);
    }, 800);
  };

  const commitInfluencers = async (items: CampaignInfluencer[]) => {
    const { influencers: next, inserted, updated } = dataService.upsertInfluencers(items);
    setInfluencers(next);
    setBulkMessage(`${inserted} added, ${updated} updated.`);
    return { inserted, updated };
  };

  const handleRecruitInfluencer = () => {
    const username = newInfluencer.username.trim();
    if (!username || username === '@') {
      setBulkMessage('Add a valid influencer username before recruiting.');
      return;
    }

    const now = Date.now();
    const influencer: CampaignInfluencer = {
      id: `CI-${now}`,
      influencerId: `INF-${now.toString().slice(-6)}`,
      username: username.startsWith('@') ? username : `@${username}`,
      platform: newInfluencer.platform,
      status: newInfluencer.status,
      city: newInfluencer.city,
      country: newInfluencer.country,
      niche: newInfluencer.niche,
      followerRange: newInfluencer.followerRange,
      ownerId: newInfluencer.ownerId,
      campaignId: newInfluencer.campaignId,
      invitationWave: 1,
      reminder1Sent: false,
      reminder2Sent: false,
      visitCompleted: false,
      coverageReceived: false,
      qaStatus: 'Pending',
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
    };

    const updated = dataService.addInfluencers([influencer]);
    setInfluencers(updated);
    notify('Influencer Recruited', `${influencer.username} added to the roster`, 'green', '/influencers');
    setIsRecruitOpen(false);
    setBulkMessage(`${influencer.username} added to the influencer roster.`);
    setNewInfluencer({
      username: '@',
      platform: 'Instagram',
      status: 'Pending',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      niche: 'Lifestyle',
      followerRange: '100k-500k',
      ownerId: 'Admin User',
      campaignId: 'C-001',
    });
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: keyof CampaignInfluencer }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <button 
        onClick={() => handleSort(sortKey)} 
        className={cn(
          "flex items-center gap-2 hover:text-[var(--ink-900)] transition-colors outline-none",
          isActive ? "text-[var(--ink-900)]" : "text-[var(--ink-400)]"
        )}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
        ) : (
          <ArrowUpDown size={14} className="opacity-40" />
        )}
      </button>
    );
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-8 animate-in fade-in duration-500 relative pb-24">
      <div className="flex justify-between items-end mb-10">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Roster Integrity</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Influencer Corps</h2>
          <p className="text-[var(--ink-700)] flex items-center gap-2 mt-2 font-mono text-[13px]">
            <Users size={16} className="text-[var(--gc-purple)]" />
            Managing active influencer roster across <span className="font-bold text-[var(--ink-900)]">{influencers.length}</span> operations.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-[var(--white)] border border-[var(--border)] rounded-full p-1.5 shadow-sm">
             <button 
               onClick={() => setViewMode('list')}
               className={cn("p-2.5 rounded-full transition-all", viewMode === 'list' ? "bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] shadow-sm" : "text-[var(--ink-400)] hover:bg-[var(--bg)] hover:text-[var(--ink-700)]")}
             >
               <List size={20} />
             </button>
             <button 
               onClick={() => setViewMode('grid')}
               className={cn("p-2.5 rounded-full transition-all", viewMode === 'grid' ? "bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] shadow-sm" : "text-[var(--ink-400)] hover:bg-[var(--bg)] hover:text-[var(--ink-700)]")}
             >
               <LayoutGrid size={20} />
             </button>
          </div>
          <button
            onClick={() => setIsRecruitOpen(true)}
            className="bg-gc-orange text-white rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors flex items-center gap-2 shadow-[var(--shadow-lg)] px-6 py-3.5 h-auto text-[12px]"
          >
            <UserPlus size={18} /> Recruit Influencer
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfluencerSummaryCard
          label="Today's Scheduled Visits"
          value={influencerSummary.scheduledToday}
          detail="Influencer visits due today"
          icon={CalendarCheck}
          tone="text-gc-orange"
        />
        <InfluencerSummaryCard
          label="Request for Approval Influencers"
          value={influencerSummary.approvalRequests}
          detail="Pending or fix-required approval"
          icon={UserCheck}
          tone="text-purple-600"
        />
        <InfluencerSummaryCard
          label="Missed Visits"
          value={influencerSummary.missedVisits}
          detail="Past visits needing follow-up"
          icon={AlertTriangle}
          tone="text-red-600"
        />
      </div>

      {isRecruitOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={() => setIsRecruitOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Creator Roster</p>
                <h3 className="font-condensed text-[20px] font-extrabold text-foreground">Recruit Influencer</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Add a creator directly into the active operations roster.</p>
              </div>
              <button onClick={() => setIsRecruitOpen(false)} className="icon-btn">
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
              <FormField label="Username">
                <input className="settings-input" value={newInfluencer.username} onChange={(event) => setNewInfluencer({ ...newInfluencer, username: event.target.value })} />
              </FormField>
              <FormField label="Platform">
                <select className="settings-input" value={newInfluencer.platform} onChange={(event) => setNewInfluencer({ ...newInfluencer, platform: event.target.value })}>
                  {['Instagram', 'TikTok', 'Snapchat', 'YouTube'].map(platform => <option key={platform}>{platform}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="settings-input" value={newInfluencer.status} onChange={(event) => setNewInfluencer({ ...newInfluencer, status: event.target.value as CampaignInfluencer['status'] })}>
                  {['Pending', 'Invited', 'Confirmed', 'Scheduled', 'Completed', 'Dropped'].map(status => <option key={status}>{status}</option>)}
                </select>
              </FormField>
              <FormField label="Follower Range">
                <select className="settings-input" value={newInfluencer.followerRange} onChange={(event) => setNewInfluencer({ ...newInfluencer, followerRange: event.target.value })}>
                  {ranges.filter(range => range !== 'all').map(range => <option key={range}>{range}</option>)}
                </select>
              </FormField>
              <FormField label="Niche">
                <input className="settings-input" value={newInfluencer.niche} onChange={(event) => setNewInfluencer({ ...newInfluencer, niche: event.target.value })} />
              </FormField>
              <FormField label="City">
                <input className="settings-input" value={newInfluencer.city} onChange={(event) => setNewInfluencer({ ...newInfluencer, city: event.target.value })} />
              </FormField>
              <FormField label="Country">
                <input className="settings-input" value={newInfluencer.country} onChange={(event) => setNewInfluencer({ ...newInfluencer, country: event.target.value })} />
              </FormField>
              <FormField label="Owner">
                <input className="settings-input" value={newInfluencer.ownerId} onChange={(event) => setNewInfluencer({ ...newInfluencer, ownerId: event.target.value })} />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setIsRecruitOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
              <button onClick={handleRecruitInfluencer} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">
                <UserPlus size={15} />
                Add Influencer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Bulk Influencer Upload</p>
            <p className="text-xs text-muted-foreground">Supports `.xlsx`, `.xls`, and `.csv`. Columns can include username, platform, status, city, country, niche, followerRange, owner, campaignId.</p>
            {bulkMessage && <p className="mt-1 text-xs font-semibold text-gc-orange">{bulkMessage}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkUploadButton<CampaignInfluencer>
            label="Import"
            title="Bulk Import Influencers"
            templateHeaders={['id','campaignId','influencerId','username','platform','status','city','country','niche','followerRange','ownerId']}
            parse={rowsToInfluencers}
            validate={i => {
              const errs: string[] = [];
              if (!i.username) errs.push('Missing username');
              if (!i.campaignId) errs.push('Missing campaignId');
              return errs;
            }}
            commit={commitInfluencers}
          />
          <button
            onClick={() => exportInfluencers(sortedInfluencers)}
            className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-3 py-2 text-xs font-bold text-white hover:bg-gc-orange/90"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink-900)] text-white px-8 py-5 rounded-full shadow-[var(--shadow-xl)] flex items-center gap-6 animate-in slide-in-from-bottom-8 duration-300 border border-[var(--ink-700)]">
           <div className="flex items-center gap-4 pr-6 border-r border-[var(--ink-700)]">
              <div className="w-8 h-8 rounded-full bg-[var(--gc-purple)] flex items-center justify-center font-bold text-[14px]">
                 {selectedIds.length}
              </div>
              <p className="text-[13px] font-bold tracking-tight text-white uppercase">Selected</p>
           </div>
           
           <div className="flex items-center gap-2">
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-[var(--ink-300)] mr-3">Bulk Status Update:</p>
              {['Pending', 'Invited', 'Confirmed', 'Scheduled', 'Completed', 'Dropped'].map(s => (
                <button 
                  key={s}
                  onClick={() => handleBulkStatusChange(s as any)}
                  disabled={isBulkUpdating}
                  className="px-5 py-2.5 rounded-full text-[11px] font-display font-extrabold uppercase tracking-widest bg-[var(--ink-700)] hover:bg-[var(--gc-purple)] hover:text-white transition-colors border border-transparent disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
           </div>

           <div className="pl-6 border-l border-[var(--ink-700)] flex items-center gap-3">
              <button 
                onClick={() => setSelectedIds([])}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--ink-700)] text-[var(--ink-300)] hover:text-white hover:bg-[var(--danger)] transition-colors"
                title="Cancel selection"
              >
                <X size={18} />
              </button>
           </div>
           
           {isBulkUpdating && (
             <div className="absolute inset-x-0 -bottom-1 px-4">
                <div className="h-[3px] w-full bg-[var(--ink-700)] rounded-full overflow-hidden">
                   <div className="h-full bg-[var(--gc-purple)] animate-pulse" style={{ width: '100%' }} />
                </div>
             </div>
           )}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm border border-[var(--border)] bg-[var(--white)] overflow-hidden">
        <div className="p-6 border-b border-[var(--border)] flex flex-col gap-6 bg-[var(--bg)]/50">
           <div className="flex justify-between items-center">
              <div className="relative w-[380px]">
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-400)] peer-focus:text-[var(--gc-purple)] transition-colors" />
                 <input 
                   className="peer w-full pl-12 pr-4 py-3.5 text-[13px] outline-none font-bold bg-[var(--white)] border border-[var(--border-strong)] rounded-full focus:border-[var(--gc-purple)] focus:ring-[4px] focus:ring-[var(--gc-purple-soft)] transition-all shadow-sm placeholder:text-[var(--ink-300)] text-[var(--ink-900)]" 
                   placeholder="Search by username, platform, city..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3.5 border rounded-full text-[12px] font-display font-bold uppercase tracking-widest transition-all shadow-sm",
                  isFilterOpen ? "bg-foreground text-white border-slate-900" : "bg-[var(--white)] text-[var(--ink-700)] border-[var(--border-strong)] hover:bg-[var(--bg)]"
                )}
              >
                 <Filter strokeWidth={2.5} size={16} /> Global Filters
              </button>
           </div>

           {isFilterOpen && (
             <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 pb-2"
             >
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content Pillar (Niche)</label>
                   <select 
                     className="w-full px-4 py-2.5 border border-border rounded-xl text-xs font-bold bg-[var(--white)] focus:ring-2 focus:ring-[var(--gc-purple-soft)] outline-none transition-all cursor-pointer shadow-sm"
                     value={selectedNiche}
                     onChange={e => setSelectedNiche(e.target.value)}
                   >
                     {niches.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follower Range</label>
                   <select 
                     className="w-full px-4 py-2.5 border border-border rounded-xl text-xs font-bold bg-[var(--white)] focus:ring-2 focus:ring-[var(--gc-purple-soft)] outline-none transition-all cursor-pointer shadow-sm"
                     value={selectedRange}
                     onChange={e => setSelectedRange(e.target.value)}
                   >
                     {ranges.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                   </select>
                </div>

                <div className="flex items-end">
                   <button 
                     onClick={() => {
                       setSelectedNiche('all');
                       setSelectedRange('all');
                       setSearchQuery('');
                     }}
                     className="text-[10px] font-black uppercase tracking-widest text-[var(--gc-orange)] hover:underline underline-offset-4"
                   >
                      Reset All Filters
                   </button>
                </div>
             </motion.div>
           )}
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--bg)]">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border w-[70px] pl-6 border-b border-[var(--border)] py-4">
                     <button 
                       onClick={toggleSelectAll}
                       className="p-1.5 hover:bg-[var(--ink-100)] rounded-md transition-colors"
                     >
                       {selectedIds.length === sortedInfluencers.length && sortedInfluencers.length > 0 
                         ? <CheckSquare size={20} className="text-[var(--gc-purple)]" /> 
                         : <Square size={20} className="text-[var(--ink-300)]" />}
                     </button>
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border border-b border-[var(--border)] py-4"><SortableHeader label="Influencer Identity" sortKey="username" /></th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border border-b border-[var(--border)] py-4"><SortableHeader label="Platform" sortKey="platform" /></th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border border-b border-[var(--border)] py-4"><SortableHeader label="Operational Status" sortKey="status" /></th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border border-b border-[var(--border)] py-4"><SortableHeader label="City / Market" sortKey="city" /></th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border border-b border-[var(--border)] pr-6 text-right py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--white)]">
                {sortedInfluencers.length > 0 ? sortedInfluencers.map((inf) => (
                  <tr 
                    key={inf.id} 
                    className={cn(
                      "px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors group transition-all border-l-4 border-transparent",
                      selectedIds.includes(inf.id) ? "bg-[var(--gc-purple-soft)]/30 border-l-[var(--gc-purple)]" : "hover:bg-[var(--bg)] hover:border-l-[var(--ink-300)]"
                    )}
                  >
                    <td className="px-6 py-5">
                       <button 
                         onClick={() => toggleSelect(inf.id)}
                         className="p-1.5 rounded-md hover:bg-[var(--white)]"
                       >
                         {selectedIds.includes(inf.id) 
                           ? <CheckSquare size={20} className="text-[var(--gc-purple)]" /> 
                           : <Square size={20} className="text-[var(--ink-300)] group-hover:text-[var(--ink-500)] transition-colors" />}
                       </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg)] flex items-center justify-center font-display font-black text-[var(--gc-purple)] border border-[var(--border-strong)] shadow-sm">
                          {inf.username.substring(1, 2).toUpperCase()}
                        </div>
                        <div>
                          <input 
                            className="text-[14px] font-bold text-[var(--ink-900)] bg-transparent border-none outline-none focus:ring-[2px] focus:ring-[var(--gc-purple-mid)] rounded px-1 -mx-1 transition-all block w-[160px] cursor-text hover:bg-[var(--ink-100)] focus:bg-[var(--white)]"
                            value={inf.username}
                            onChange={(e) => {
                              const updated = dataService.updateInfluencer(inf.id, { username: e.target.value });
                              setInfluencers(updated);
                            }}
                          />
                          <p className="text-[11px] text-[var(--ink-400)] font-mono mt-1 uppercase tracking-wider pl-1">ID-{inf.influencerId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <select 
                         value={inf.platform}
                         onChange={(e) => {
                           const updated = dataService.updateInfluencer(inf.id, { platform: e.target.value });
                           setInfluencers(updated);
                         }}
                         className="text-[12px] font-bold text-[var(--ink-700)] bg-transparent outline-none cursor-pointer hover:bg-[var(--ink-100)] px-2 py-1 -mx-2 rounded transition-colors"
                       >
                         {['Instagram', 'TikTok', 'Snapchat', 'YouTube'].map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                    </td>
                    <td className="px-6 py-5">
                       <select 
                         value={inf.status}
                         onChange={(e) => handleUpdateStatus(inf.id, e.target.value as any)}
                         className={cn(
                           "text-[10px] font-display font-black uppercase tracking-widest px-3.5 py-1.5 rounded-md outline-none cursor-pointer transition-colors border shadow-sm",
                           inf.status === 'Confirmed' || inf.status === 'Completed' ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20 hover:bg-[var(--success)]/20" :
                           inf.status === 'Pending' || inf.status === 'Scheduled' ? "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20 hover:bg-[var(--warning)]/20" : 
                           "bg-[var(--bg)] text-[var(--ink-700)] border-[var(--border-strong)] hover:bg-[var(--ink-100)]"
                         )}
                       >
                         {['Pending', 'Invited', 'Confirmed', 'Scheduled', 'Completed', 'Dropped'].map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </td>
                    <td className="px-6 py-5">
                       <input 
                         className="text-[13px] font-bold text-[var(--ink-700)] bg-transparent border-none outline-none focus:ring-[2px] focus:ring-[var(--gc-purple-mid)] rounded px-2 py-1 -mx-2 transition-all w-[120px] cursor-text hover:bg-[var(--ink-100)] focus:bg-[var(--white)]"
                         value={inf.city || 'Riyadh'}
                         onChange={(e) => handleUpdateCity(inf.id, e.target.value)}
                         placeholder="Enter city..."
                       />
                    </td>
                    <td className="px-6 py-5 pr-8 text-right">
                      {confirmDeleteId === inf.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] font-bold text-destructive whitespace-nowrap">Delete?</span>
                          <button onClick={() => handleDelete(inf.id)} className="px-2 py-1 bg-destructive text-white rounded text-[10px] font-bold hover:bg-destructive/90">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 border border-border rounded text-[10px] font-bold hover:bg-accent">No</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/influencers/${inf.id}`)}
                            className="p-2.5 text-[var(--ink-400)] hover:text-[var(--gc-purple)] hover:bg-[var(--gc-purple-soft)] rounded-md transition-all"
                            title="View Profile"
                          >
                            <ExternalLink size={18} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(inf.id)}
                            className="p-2.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                            title="Remove Influencer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-[var(--ink-400)] font-medium text-[14px]">No operations matched your filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-[var(--bg)]/50">
             {sortedInfluencers.map(inf => (
               <div 
                 key={inf.id} 
                 onClick={() => toggleSelect(inf.id)}
                 className={cn(
                   "bg-card border border-border rounded-xl overflow-hidden p-8 flex flex-col items-center text-center group relative cursor-pointer outline outline-0 outline-[var(--gc-purple)] bg-[var(--white)] shadow-sm hover:shadow-[var(--shadow-md)]",
                   selectedIds.includes(inf.id) ? "outline-2 bg-[var(--gc-purple-soft)]/20 scale-[0.98] shadow-sm transform-none" : "hover:-translate-y-1"
                 )}
               >
                  {selectedIds.includes(inf.id) && (
                    <div className="absolute top-4 right-4 text-[var(--gc-purple)] bg-[var(--white)] rounded-full">
                       <CheckCircle2 size={24} />
                    </div>
                  )}
                  <div className="w-[84px] h-[84px] rounded-2xl bg-[var(--bg)] border border-[var(--border-strong)] text-[var(--gc-purple)] flex items-center justify-center font-display font-black text-3xl mb-6 group-hover:rotate-[10deg] transition-transform shadow-sm">
                    {inf.username.substring(1, 2).toUpperCase()}
                  </div>
                  <h3 className="text-[16px] font-bold text-[var(--ink-900)] mb-1 tracking-tight">{inf.username}</h3>
                  <p className="text-[12px] font-mono font-bold text-[var(--ink-500)] mb-6 uppercase tracking-wider">{inf.platform}</p>
                  
                  <div className={cn(
                    "w-full py-2.5 rounded-lg text-[10px] font-display font-black uppercase tracking-widest mb-6 border shadow-sm",
                    inf.status === 'Confirmed' || inf.status === 'Completed' ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" :
                    inf.status === 'Pending' || inf.status === 'Scheduled' ? "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20" : 
                    "bg-[var(--bg)] text-[var(--ink-500)] border-[var(--border-strong)]"
                  )}>
                    {inf.status}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/influencers/${inf.id}`); }}
                      className="flex-1 py-4 border border-[var(--border-strong)] rounded-xl text-[11px] font-display font-black uppercase tracking-widest text-[var(--ink-700)] hover:bg-[var(--gc-purple)] hover:text-white hover:border-[var(--gc-purple)] transition-all shadow-sm"
                    >
                      Detail
                    </button>
                    {confirmDeleteId === inf.id ? (
                      <div className="flex gap-1 items-center">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(inf.id); }} className="px-3 py-2 bg-destructive text-white rounded-xl text-[10px] font-bold">Yes</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="px-3 py-2 border border-border rounded-xl text-[10px] font-bold hover:bg-accent">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(inf.id); }}
                        className="px-4 py-4 border border-destructive/30 rounded-xl text-destructive/60 hover:text-destructive hover:bg-destructive/10 hover:border-destructive transition-all shadow-sm"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfluencerSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-2 text-3xl font-black tabular-nums ${tone}`}>{value}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-gc-orange">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
