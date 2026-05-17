/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  UserPlus, 
  Globe, 
  Target, 
  Hash, 
  Zap, 
  TrendingUp, 
  ShieldCheck,
  Layers,
  RefreshCw,
  MapPin,
  Instagram,
  Video,
  Youtube,
  Smartphone,
  Download,
  Moon,
  Sun,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { AI_PROVIDER_PRESETS, discoverInfluencers, getDiscoveryProviderConfig, SuggestedInfluencer } from '../services/geminiService';
import { dataService } from '../services/dataService';

const PLATFORM_ICONS: Record<string, any> = {
  Instagram: Instagram,
  TikTok: Video,
  YouTube: Youtube,
  Snapchat: Smartphone
};

export default function InfluencerDiscovery() {
  const campaigns = React.useMemo(() => dataService.getCampaigns(), []);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SuggestedInfluencer[]>([]);
  const [statusMessage, setStatusMessage] = useState('Initializing search relays...');
  const [providerConfig, setProviderConfig] = useState(() => getDiscoveryProviderConfig());
  const [providerStatus, setProviderStatus] = useState('');
  const [addedHandles, setAddedHandles] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [criteria, setCriteria] = useState({
    campaignContext: 'none',
    country: 'Saudi Arabia',
    niche: 'Luxury Lifestyle',
    range: '100k-500k',
    count: 20
  });

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  const handleExport = () => {
    if (results.length === 0) {
      alert("No data to export. Please run a discovery search first.");
      return;
    }
    const headers = ['Handle', 'Platform', 'Niche', 'Followers', 'Engagement', 'Location', 'Relevance'];
    const csvRows = [headers.join(',')];
    
    for (const r of results) {
      const values = [
        r.handle,
        r.platform,
        r.niche,
        r.followers,
        r.engagement,
        `"${r.location.replace(/"/g, '""')}"`,
        `"${r.relevanceReason.replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `discovery_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addToMission = (inf: SuggestedInfluencer) => {
    if (addedHandles.includes(inf.handle)) return;
    const now = Date.now();
    dataService.addInfluencers([{
      id: `CI-${now}`,
      campaignId: criteria.campaignContext === 'none' ? (campaigns[0]?.id || 'C-001') : criteria.campaignContext,
      influencerId: `INF-${now.toString().slice(-6)}`,
      username: inf.handle.startsWith('@') ? inf.handle : `@${inf.handle}`,
      platform: inf.platform,
      status: 'Pending',
      niche: inf.niche,
      followerRange: inf.followers,
      city: inf.location,
      country: criteria.country,
      invitationWave: 1,
      reminder1Sent: false,
      reminder2Sent: false,
      visitCompleted: false,
      coverageReceived: false,
      qaStatus: 'Pending',
      notes: inf.relevanceReason,
      ownerId: 'AI Discovery',
      createdAt: now,
      updatedAt: now,
      createdBy: 'ai-discovery',
    }]);
    setAddedHandles(prev => [...prev, inf.handle]);
  };

  const loadingSteps = [
    `Initializing ${AI_PROVIDER_PRESETS[providerConfig.provider].label} provider...`,
    'Preparing creator discovery prompt...',
    'Analyzing Cross-Platform Engagement Patterns...',
    providerConfig.provider === 'gemini' || providerConfig.provider === 'perplexity' ? 'Activating search-grounded verification...' : 'Normalizing structured creator output...',
    'Synthesizing Tactical Alignment Insights...',
    'Finalizing Creator Roster...'
  ];

  useEffect(() => {
    const syncProvider = () => setProviderConfig(getDiscoveryProviderConfig());
    window.addEventListener('storage', syncProvider);
    syncProvider();
    return () => window.removeEventListener('storage', syncProvider);
  }, []);

  useEffect(() => {
    if (loading) {
      let step = 0;
      const interval = setInterval(() => {
        setStatusMessage(loadingSteps[step % loadingSteps.length]);
        step++;
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeProvider = getDiscoveryProviderConfig();
    setProviderConfig(activeProvider);
    setProviderStatus(activeProvider.mode === 'live' && activeProvider.apiKey
      ? `Running live extraction through ${AI_PROVIDER_PRESETS[activeProvider.provider].label}.`
      : `No live key configured for ${AI_PROVIDER_PRESETS[activeProvider.provider].label}. Using high-fidelity demo extraction.`
    );
    setLoading(true);
    try {
      const influencers = await discoverInfluencers(
        criteria.country, 
        criteria.niche, 
        criteria.range,
        criteria.count,
        criteria.campaignContext
      );
      setResults(influencers);
    } catch (err) {
      console.error(err);
      // Fallback or error handled by parent/notification
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
      {/* Utility Bar */}
      <div className="flex justify-end gap-3">
         <button 
           onClick={handleExport}
           className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold uppercase tracking-wide hover:bg-gray-50 hover:border-gc-orange/40 transition-colors text-[10px] flex items-center gap-2 disabled:opacity-50 dark:bg-card dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
           disabled={results.length === 0}
         >
           <Download size={14} /> Export CSV
         </button>
         <button 
           onClick={toggleTheme}
           className="bg-gc-orange text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors text-[10px] flex items-center gap-2"
         >
           {isDarkMode ? <Sun size={14} /> : <Moon size={14} />} 
           {isDarkMode ? 'Light Mode' : 'Dark Mode'}
         </button>
      </div>

      {/* Immersive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-card p-8 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gc-orange" />
        <div className="absolute -right-10 -bottom-16 h-52 w-52 rounded-full bg-orange-50 dark:bg-orange-900/10 pointer-events-none" />
        
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-orange-50 text-gc-orange rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100 dark:bg-orange-900/20 dark:border-orange-900/30">
                System Active
             </div>
             <div className="flex gap-1">
                {[1,2,3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-green-500" />
                ))}
             </div>
          </div>
          <div>
            <h1 className="text-5xl font-display font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-2">
              AI Discovery <span className="text-gc-orange">Engine</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl font-medium leading-relaxed italic">
              Deploying provider-driven creator intelligence to identify <span className="text-gray-900 dark:text-white font-bold">authentic creator-market alignment</span> in real-time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 w-full md:w-auto">
          <div className="bg-white dark:bg-card border border-green-100 dark:border-green-900/30 p-4 rounded-xl flex flex-col justify-center items-start gap-1 min-w-[120px] shadow-sm">
             <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Efficiency</span>
             <span className="text-2xl font-mono font-black text-green-600 dark:text-green-400">98.4%</span>
          </div>
          <div className="bg-white dark:bg-card border border-orange-100 dark:border-orange-900/30 p-4 rounded-xl flex flex-col justify-center items-start gap-1 min-w-[120px] shadow-sm">
             <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Grounding</span>
             <span className="text-2xl font-mono font-black text-gc-orange">{providerConfig.mode}</span>
          </div>
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-gray-800 p-4 rounded-xl flex flex-col justify-center items-start gap-1 min-w-[150px] shadow-sm">
             <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Provider</span>
             <span className="text-lg font-mono font-black text-gray-900 dark:text-white truncate max-w-[130px]">{AI_PROVIDER_PRESETS[providerConfig.provider].label}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-6">
          <motion.form 
            onSubmit={handleSearch} 
            className="bg-white dark:bg-card border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden p-6 space-y-6 shadow-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tactical Constraints</h3>
              <Zap size={14} className="text-[var(--gc-orange)]" />
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-3 text-[11px] font-semibold text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/10 dark:text-orange-300">
              <div className="flex items-center justify-between gap-2">
                <span>{AI_PROVIDER_PRESETS[providerConfig.provider].label}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] uppercase tracking-wider dark:bg-black/20">{providerConfig.mode}</span>
              </div>
              <p className="mt-1 text-orange-600/80 dark:text-orange-300/80">{providerConfig.model}</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Layers size={14} className="text-muted-foreground"/> Campaign Targeting</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-bold bg-white dark:bg-background focus:border-gc-orange focus:ring-2 focus:ring-gc-orange/15 outline-none transition-all cursor-pointer shadow-sm"
                  value={criteria.campaignContext}
                  onChange={e => setCriteria({...criteria, campaignContext: e.target.value})}
                >
                  <option value="none">-- Target Registry --</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Globe size={14} className="text-muted-foreground"/> Primary Market</label>
                <input 
                  required
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-bold bg-white dark:bg-background focus:border-gc-orange focus:ring-2 focus:ring-gc-orange/15 outline-none transition-all"
                  placeholder="e.g. Saudi Arabia"
                  value={criteria.country}
                  onChange={e => setCriteria({...criteria, country: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Hash size={14} className="text-muted-foreground"/> Content Pillar</label>
                <input 
                  required
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-bold bg-white dark:bg-background focus:border-gc-orange focus:ring-2 focus:ring-gc-orange/15 outline-none transition-all"
                  placeholder="e.g. Gen Z Tech"
                  value={criteria.niche}
                  onChange={e => setCriteria({...criteria, niche: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Target size={14} className="text-muted-foreground"/> Follower Range</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-bold bg-white dark:bg-background focus:border-gc-orange focus:ring-2 focus:ring-gc-orange/15 outline-none transition-all cursor-pointer"
                  value={criteria.range}
                  onChange={e => setCriteria({...criteria, range: e.target.value})}
                >
                  <option value="10k-50k">MICRO (10K - 50K)</option>
                  <option value="50k-100k">MID-TIER (50K - 100K)</option>
                  <option value="100k-500k">MACRO (100K - 500K)</option>
                  <option value="500k-1M">MEGA (500K - 1M+)</option>
                </select>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2 font-black"><Layers size={14} className="text-muted-foreground"/> Extraction Density</label>
                 <div className="flex items-center gap-2 py-2">
                    {[10, 20, 30].map(num => (
                      <button 
                        key={num}
                        type="button"
                        onClick={() => setCriteria({...criteria, count: num})}
                        className={cn(
                          "flex-1 py-1.5 text-[10px] font-black rounded-lg border transition-all",
                          criteria.count === num ? "bg-gc-orange text-white border-gc-orange shadow-sm" : "bg-white dark:bg-background text-muted-foreground border-border hover:bg-orange-50 hover:text-gc-orange dark:hover:bg-orange-900/10"
                        )}
                      >
                         MAX {num}
                      </button>
                    ))}
                 </div>
              </div>
            </div>

            <div className="pt-4">
               <button 
                 type="submit"
                 disabled={loading}
                 className="w-full py-4 bg-gc-orange text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gc-orange/90 transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 group"
               >
                 {loading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                 {loading ? 'Processing...' : 'Deploy Extraction'}
               </button>
            </div>
          </motion.form>

          {/* Quick Insights Card */}
          <div className="bg-white dark:bg-card border border-orange-100 dark:border-orange-900/30 rounded-xl overflow-hidden p-6 text-foreground relative shadow-sm group">
           <TrendingUp size={80} className="absolute -bottom-4 -right-4 text-orange-100 dark:text-orange-900/30 group-hover:scale-110 transition-transform" />
             <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gc-orange mb-4">Provider Status</h4>
                <p className="text-lg font-bold tracking-tight leading-tight mb-2 text-foreground">Sustainable Fashion Jeddah is spiking by +14.2%</p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase bg-orange-50 text-gc-orange border border-orange-100 w-fit px-2 py-1 rounded-lg dark:bg-orange-900/20 dark:border-orange-900/30">
                   {providerConfig.mode === 'live' ? 'Live API' : 'Demo Safe'} • {AI_PROVIDER_PRESETS[providerConfig.provider].label}
                </div>
             </div>
          </div>
        </div>

        {/* Results Workspace */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="bg-white dark:bg-card border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col items-center justify-center text-center p-12 relative shadow-sm"
              >
                 <div className="absolute top-0 left-0 w-full h-1 bg-orange-50 dark:bg-orange-900/20">
                    <motion.div 
                      className="h-full bg-gc-orange" 
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 12, repeat: Infinity }}
                    />
                 </div>
                 
                 <div className="relative mb-8">
                    <div className="w-24 h-24 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-gc-orange shadow-sm border border-orange-100 dark:border-orange-900/30">
                       <Sparkles size={40} />
                    </div>
                    <div className="absolute -inset-3 border border-dashed border-orange-200 dark:border-orange-900/40 rounded-2xl opacity-70" />
                 </div>

                 <h3 className="text-3xl font-display font-black text-foreground mb-2 uppercase tracking-tight tabular-nums underline decoration-gc-orange decoration-4 underline-offset-8">
                    {statusMessage}
                 </h3>
                 <p className="text-muted-foreground text-sm max-w-sm mt-4 font-medium italic">
                    Synthesizing real-time creator data to match your <span className="text-[var(--gc-orange)] font-black">"{criteria.niche}"</span> constraints.
                 </p>
                 {providerStatus && (
                   <p className="mt-3 max-w-md text-xs font-semibold text-muted-foreground">
                     {providerStatus}
                   </p>
                 )}

                 <div className="mt-12 grid grid-cols-3 gap-8 opacity-20">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex flex-col items-center gap-2">
                         <div className="w-12 h-2 bg-orange-100 dark:bg-orange-900/30 rounded-full" />
                         <div className="w-20 h-2 bg-gray-100 dark:bg-gray-800 rounded-full" />
                      </div>
                    ))}
                 </div>
              </motion.div>
            ) : results.length > 0 ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {results.map((inf, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white dark:bg-card border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden hover:border-gc-orange/40 hover:shadow-lg transition-all group cursor-pointer"
                  >
                    <div className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-2xl bg-orange-50 text-gc-orange border border-orange-100 flex items-center justify-center font-display font-black text-xl shadow-sm group-hover:rotate-6 transition-transform dark:bg-orange-900/20 dark:border-orange-900/30">
                              {inf.handle.substring(1, 2).toUpperCase()}
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-xl font-black text-foreground tracking-tight">{inf.handle}</h4>
                                <ShieldCheck size={16} className="text-blue-500 fill-blue-50" />
                              </div>
                              <div className="flex items-center gap-2">
                                 {React.createElement(PLATFORM_ICONS[inf.platform] || Smartphone, { size: 12, className: "text-muted-foreground" })}
                                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{inf.platform}</span>
                                 <div className="w-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-gc-orange">{inf.niche}</span>
                              </div>
                           </div>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                           <TrendingUp size={16} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reach Strength</p>
                            <p className="text-xl font-mono font-black text-foreground">{inf.followers}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Interaction Velocity</p>
                            <p className="text-xl font-mono font-black text-emerald-600">{inf.engagement}</p>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-lg bg-orange-50 text-gc-orange border border-orange-100 dark:bg-orange-900/20 dark:border-orange-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                               <Sparkles size={12} />
                            </div>
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">
                               "{inf.relevanceReason}"
                            </p>
                         </div>
                         
                         <div className="grid grid-cols-1 gap-3 pl-9">
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase tracking-widest text-[var(--gc-orange)] flex items-center gap-1">
                                 <TrendingUp size={10} /> Recent Performance
                               </p>
                               <p className="text-[11px] text-muted-foreground leading-normal">{inf.recentPerformance}</p>
                            </div>
                            <div className="space-y-1">
                               <p className="text-[9px] font-black uppercase tracking-widest text-gc-orange flex items-center gap-1">
                                 <Users size={10} /> Audience Alignment
                               </p>
                               <p className="text-[11px] text-muted-foreground leading-normal">{inf.audienceAlignment}</p>
                            </div>
                         </div>

                         <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground tracking-widest pl-9">
                            <MapPin size={10} />
                            {inf.location}
                         </div>
                      </div>

                      <button
                        onClick={() => addToMission(inf)}
                        className={cn(
                          "w-full py-4 text-white text-[11px] font-black uppercase tracking-widest rounded-xl border-2 transition-all flex items-center justify-center gap-3 overflow-hidden group/btn relative",
                          addedHandles.includes(inf.handle)
                            ? "bg-emerald-600 border-emerald-600 cursor-default"
                            : "bg-gc-orange border-gc-orange hover:bg-gc-orange/90 hover:shadow-lg hover:-translate-y-0.5"
                        )}
                      >
                        <span className="relative z-10 flex items-center gap-2">
                           <UserPlus size={16} /> {addedHandles.includes(inf.handle) ? 'Added to Roster' : 'Add to Mission Structure'}
                        </span>
                        <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-10 transition-opacity" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-card border border-dashed border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col items-center justify-center text-center p-20 group shadow-sm"
              >
                 <div className="w-28 h-28 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-gc-orange border border-orange-100 dark:border-orange-900/30 group-hover:scale-105 transition-transform shadow-sm mb-8">
                    <Layers size={60} strokeWidth={1} />
                 </div>
                 <h3 className="text-2xl font-display font-black text-foreground uppercase tracking-widest mb-4">Ready for Deployment</h3>
                 <p className="text-muted-foreground text-sm max-w-md font-medium">Input your required market and niche parameters in the control panel to initialize creator extraction.</p>
                 
                 <div className="mt-10 flex gap-4">
                    {['Riyadh', 'Fashion', 'Meta-Trends'].map(tag => (
                      <span key={tag} className="px-3 py-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-full text-[10px] font-black uppercase tracking-wider text-gc-orange">#{tag}</span>
                    ))}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
