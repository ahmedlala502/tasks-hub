import React, { useState, useMemo } from 'react';
import { 
  Settings2, 
  Save, 
  Link2, 
  Hash, 
  AtSign, 
  Package, 
  MapPin, 
  FileText, 
  Users, 
  Target, 
  ShieldCheck,
  Lock,
  UploadCloud,
  Search,
  X,
  Plus,
  Info
} from 'lucide-react';
import { cn } from '../utils';
import { Campaign } from '../types';
import { dataService } from '../services/dataService';

const AVAILABLE_USERS = [
  { name: 'Sarah Ahmed', role: 'Ops Lead', avatar: 'SA', type: 'internal' },
  { name: 'Ahmed Essmat', role: 'Account Manager', avatar: 'AE', type: 'internal' },
  { name: 'Mona Khalid', role: 'Community Team', avatar: 'MK', type: 'internal' },
  { name: 'John Doe', role: 'Client Stakeholder', avatar: 'JD', type: 'client' },
  { name: 'Saleh Rashid', role: 'Brand Manager', avatar: 'SR', type: 'client' },
  { name: 'Yousuf Mansour', role: 'Marketing Director', avatar: 'YM', type: 'client' },
];

export default function CampaignSetup() {
  const [activeCampaign, setActiveCampaign] = useState<Partial<Campaign>>(dataService.getCampaigns()[0] || {});
  const [isSaving, setIsSaving] = useState(false);
  const [searchInternal, setSearchInternal] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [showInternalSearch, setShowInternalSearch] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, size: string, date: string, type: string}[]>([
    { name: 'Red_Bull_Summer_KSA_Brief_V2.pdf', size: '2.4 MB', date: 'Oct 12, 2024', type: 'PDF' }
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setActiveCampaign(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
  };

  const processFile = (file: File) => {
    setUploadingProgress(0);
    const interval = setInterval(() => {
      setUploadingProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setUploadedFiles(prevFiles => [
            { 
              name: file.name, 
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, 
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
              type: file.name.split('.').pop()?.toUpperCase() || 'FILE'
            },
            ...prevFiles
          ]);
          setTimeout(() => setUploadingProgress(null), 500);
          return 100;
        }
        return prev + 25;
      });
    }, 300);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      if (activeCampaign.id) dataService.updateCampaign(activeCampaign.id, activeCampaign);
      setIsSaving(false);
    }, 800);
  };

  const removeOwner = (target: 'internalOwners' | 'clientOwners', name: string) => {
    setActiveCampaign(prev => ({
      ...prev,
      [target]: (prev[target] || []).filter(o => o !== name)
    }));
  };

  const addOwner = (target: 'internalOwners' | 'clientOwners', name: string) => {
    if (!(activeCampaign[target] || []).includes(name)) {
      setActiveCampaign(prev => ({
        ...prev,
        [target]: [...(prev[target] || []), name]
      }));
    }
    setShowInternalSearch(false);
    setShowClientSearch(false);
    setSearchInternal('');
    setSearchClient('');
  };

  const filteredInternal = useMemo(() => 
    AVAILABLE_USERS.filter(u => u.type === 'internal' && u.name.toLowerCase().includes(searchInternal.toLowerCase())), 
    [searchInternal]
  );

  const filteredClient = useMemo(() => 
    AVAILABLE_USERS.filter(u => u.type === 'client' && u.name.toLowerCase().includes(searchClient.toLowerCase())), 
    [searchClient]
  );

  return (
    <div className="max-w-[1240px] mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-10">
        <div className="space-y-1">
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Stage 5 Operations</div>
          <h1 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Campaign Architect</h1>
          <p className="text-[var(--ink-700)] text-[14px]">Define the logic, deliverables, and governance for <span className="font-bold text-[var(--ink-900)]">"{activeCampaign.name}"</span>.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "bg-gc-orange text-white px-4 py-2.5 rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors flex items-center gap-2 min-w-[170px] justify-center transition-all py-3.5",
            isSaving && "opacity-70 cursor-wait"
          )}
        >
          {isSaving ? <div className="w-5 h-5 border-[3px] border-[var(--ink-900)]/30 border-t-[var(--ink-900)] rounded-full animate-spin" /> : <Save size={20} />}
          {isSaving ? 'Finalizing...' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Configuration Columns */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 1: Execution & Tracking */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-8 space-y-8 bg-[var(--bg)]">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--gc-orange-soft)] text-[var(--gc-orange)] flex items-center justify-center">
                <Target size={20} strokeWidth={2.5} />
              </div>
              <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Execution & Tracking Logic</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2">Campaign Objective <Info size={14} className="text-[var(--ink-300)]" /></label>
                <select 
                  name="objective"
                  value={activeCampaign.objective || ''}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--ink-900)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none appearance-none cursor-pointer transition-all shadow-sm"
                >
                  <option value="">Select Strategy...</option>
                  <option value="Influencer Marketing">Influencer Marketing</option>
                  <option value="Performance">Performance</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                  <option value="Event Coverage">Event Coverage</option>
                  <option value="Product Launch">Product Launch</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2">
                  Campaign Deliverables <Info size={14} className="text-[var(--ink-300)]" />
                </label>
                <textarea 
                  name="deliverables"
                  value={activeCampaign.deliverables || ''}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                  placeholder="e.g. 2 Instagram Stories with swipe up, 1 TikTok integration..."
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 text-[var(--ink-900)]">Tactical Delivery Platforms *</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {['Instagram', 'TikTok', 'Snapchat', 'YouTube', 'X (Twitter)'].map(p => (
                    <button 
                      key={p} 
                      type="button"
                      onClick={() => {
                        const platforms = activeCampaign.platforms || [];
                        setActiveCampaign(prev => ({
                          ...prev,
                          platforms: platforms.includes(p) ? platforms.filter(x => x !== p) : [...platforms, p]
                        }));
                      }}
                      className={cn(
                        "px-6 py-2.5 text-[11px] font-display font-black uppercase tracking-widest rounded-full border-2 transition-all block",
                        activeCampaign.platforms?.includes(p) 
                          ? "bg-[var(--ink-900)] border-[var(--ink-900)] text-white shadow-[var(--shadow-md)]" 
                          : "bg-[var(--white)] border-[var(--border)] text-[var(--ink-500)] hover:border-[var(--border-strong)] hover:text-[var(--ink-900)]"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2">Budget Allocation *</label>
                  <input 
                    type="number"
                    name="budget"
                    value={activeCampaign.budget || ''}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--ink-900)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2">Currency *</label>
                  <select 
                    name="budgetType"
                    value={activeCampaign.budgetType || 'USD'}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--ink-900)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none appearance-none cursor-pointer transition-all shadow-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Hash size={14} /> Mandatory Hashtags</label>
                  <input 
                    name="tags"
                    value={activeCampaign.tags || ''}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-mono text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                    placeholder="#CampaignName #Vibe"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><AtSign size={14} /> Required Mentions</label>
                  <input 
                    name="mentions"
                    value={activeCampaign.mentions || ''}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-mono text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                    placeholder="@BrandAccount @Partner"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2"><Link2 size={14} /> Destination Links</label>
                <input 
                   name="links"
                   value={activeCampaign.links || ''}
                   onChange={handleInputChange}
                   className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                   placeholder="https://brand.com/campaign-landing-page"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Product & Logistics */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-8 space-y-8 bg-[var(--bg)]">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] flex items-center justify-center">
                <Package size={20} strokeWidth={2.5} />
              </div>
              <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Product & Logistics Protocol</h3>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Product / Service Details</label>
                <textarea 
                  name="productDetails"
                  value={activeCampaign.productDetails || ''}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--gc-purple)] focus:ring-[4px] focus:ring-[var(--gc-purple-soft)] outline-none transition-all shadow-sm"
                  placeholder="Describe the hero product, key features, or arrival process."
                />
              </div>

              <div className="flex items-center justify-between p-5 bg-[var(--white)] rounded-2xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                    activeCampaign.visitRequired ? "bg-[var(--gc-orange)] text-white shadow-md shadow-[var(--gc-orange-soft)]" : "bg-[var(--bg)] text-[var(--ink-300)]"
                  )}>
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[var(--ink-900)]">Physical Visit Required?</p>
                    <p className="text-[12px] text-[var(--ink-500)] italic mt-0.5">Toggle if influencers must visit a physical location.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveCampaign(prev => ({ ...prev, visitRequired: !prev.visitRequired }))}
                  className={cn(
                    "w-16 h-9 rounded-full relative transition-all duration-300 shadow-inner px-1.5 flex items-center",
                    activeCampaign.visitRequired ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 bg-[var(--white)] rounded-full shadow-md transition-all duration-300",
                    activeCampaign.visitRequired ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Section 3: Governance & Reporting */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-8 space-y-8 bg-[var(--bg)]">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center">
                <ShieldCheck size={20} strokeWidth={2.5} />
              </div>
              <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Governance & Systems</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Approval Flow</label>
                <select 
                  name="approvalFlow"
                  value={activeCampaign.approvalFlow || 'Internal Only'}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--ink-900)] focus:border-[var(--success)] focus:ring-[4px] focus:ring-[var(--success)]/20 outline-none appearance-none transition-all shadow-sm"
                >
                  <option value="Internal Only">Internal Only</option>
                  <option value="Client Approval Required">Client Approval Required</option>
                  <option value="Double Stage Verification">Double Stage Verification</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Reporting Cadence</label>
                <select 
                  name="reportingCadence"
                  value={activeCampaign.reportingCadence || 'Weekly Cycle'}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] font-bold text-[var(--ink-900)] focus:border-[var(--success)] focus:ring-[4px] focus:ring-[var(--success)]/20 outline-none appearance-none transition-all shadow-sm"
                >
                  <option value="Daily Updates">Daily Updates</option>
                  <option value="Weekly Cycle">Weekly Cycle</option>
                  <option value="Post-Campaign Only">Post-Campaign Only</option>
                  <option value="Custom Real-Time">Custom Real-Time</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 flex items-center gap-2 text-[var(--danger)]/80"><Lock size={14} /> Strategic Restrictions</label>
                <textarea 
                  name="restrictions"
                  value={activeCampaign.restrictions || ''}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[14px] text-[var(--ink-900)] placeholder:text-[var(--ink-300)] focus:border-[var(--danger)] focus:ring-[4px] focus:ring-[rgba(180,35,24,0.1)] outline-none transition-all shadow-sm"
                  placeholder="e.g. No competitor mentions (STC, Mobily), avoid religious topics..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar: Stakeholders & Assets */}
        <div className="space-y-8">
          
          {/* Section 4: Mission Stakeholders */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-6 space-y-6 bg-[var(--bg)] overflow-visible">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] flex items-center justify-center">
                <Users size={20} strokeWidth={2.5} />
              </div>
              <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Command Owners</h3>
            </div>

            <div className="space-y-6">
              {/* Internal Owners */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Internal Ops Leads</label>
                  <button 
                    onClick={() => setShowInternalSearch(!showInternalSearch)}
                    className="p-1.5 text-[var(--gc-purple)] hover:bg-[var(--gc-purple-soft)] rounded-lg transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                
                {showInternalSearch && (
                  <div className="relative animate-in slide-in-from-top-2 duration-300">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-300)]" size={16} />
                    <input 
                      autoFocus
                      placeholder="Search internal leads..."
                      value={searchInternal}
                      onChange={(e) => setSearchInternal(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[var(--white)] border border-[var(--border-strong)] rounded-xl text-[12px] font-bold text-[var(--ink-900)] outline-none focus:border-[var(--gc-purple)] focus:ring-[4px] focus:ring-[var(--gc-purple-soft)] transition-all shadow-sm"
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] z-50 max-h-56 overflow-y-auto overflow-x-hidden p-1">
                       {filteredInternal.map(u => (
                         <button 
                           key={u.name}
                           onClick={() => addOwner('internalOwners', u.name)}
                           className="w-full text-left p-3 hover:bg-[var(--bg)] rounded-lg flex items-center gap-3 transition-colors border-b border-transparent hover:border-[var(--border)]"
                         >
                            <div className="w-10 h-10 rounded-full bg-[var(--gc-purple)]/10 text-[var(--gc-purple)] flex items-center justify-center font-bold text-[12px] shrink-0">{u.avatar}</div>
                            <div>
                               <p className="text-[13px] font-bold text-[var(--ink-900)]">{u.name}</p>
                               <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{u.role}</p>
                            </div>
                         </button>
                       ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                   {(activeCampaign.internalOwners || []).map(ownerName => {
                     const userData = AVAILABLE_USERS.find(u => u.name === ownerName);
                     return (
                       <div key={ownerName} className="flex items-center justify-between p-3.5 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-sm group hover:-translate-y-px transition-all">
                          <div className="flex items-center gap-3.5">
                             <div className="w-10 h-10 rounded-full bg-[var(--gc-purple)]/10 text-[var(--gc-purple)] flex items-center justify-center font-bold text-[11px] shrink-0">
                               {userData?.avatar || ownerName.substring(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <p className="text-[13px] font-bold text-[var(--ink-900)]">{ownerName}</p>
                                <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{userData?.role || 'Internal Staff'}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => removeOwner('internalOwners', ownerName)}
                            className="p-2 text-[var(--ink-300)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-md opacity-0 group-hover:opacity-100 transition-all font-medium"
                          >
                             <X size={16} />
                          </button>
                       </div>
                     );
                   })}
                </div>
              </div>

              {/* Client Owners */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1">Client / Brand Leads</label>
                  <button 
                    onClick={() => setShowClientSearch(!showClientSearch)}
                    className="p-1.5 text-[var(--gc-orange)] hover:bg-[var(--gc-orange-soft)] rounded-lg transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {showClientSearch && (
                  <div className="relative animate-in slide-in-from-top-2 duration-300">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-300)]" size={16} />
                    <input 
                      autoFocus
                      placeholder="Search client leads..."
                      value={searchClient}
                      onChange={(e) => setSearchClient(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[var(--white)] border border-[var(--border-strong)] rounded-xl text-[12px] font-bold text-[var(--ink-900)] outline-none focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] transition-all shadow-sm"
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] z-50 max-h-56 overflow-y-auto overflow-x-hidden p-1">
                       {filteredClient.map(u => (
                         <button 
                           key={u.name}
                           onClick={() => addOwner('clientOwners', u.name)}
                           className="w-full text-left p-3 hover:bg-[var(--bg)] rounded-lg flex items-center gap-3 transition-colors border-b border-transparent hover:border-[var(--border)]"
                         >
                            <div className="w-10 h-10 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--ink-700)] flex items-center justify-center font-bold text-[12px] shrink-0">{u.avatar}</div>
                            <div>
                               <p className="text-[13px] font-bold text-[var(--ink-900)]">{u.name}</p>
                               <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{u.role}</p>
                            </div>
                         </button>
                       ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                   {(activeCampaign.clientOwners || []).map(ownerName => {
                     const userData = AVAILABLE_USERS.find(u => u.name === ownerName);
                     return (
                       <div key={ownerName} className="flex items-center justify-between p-3.5 bg-[var(--white)] border border-[var(--border)] rounded-xl shadow-sm group hover:-translate-y-px transition-all">
                          <div className="flex items-center gap-3.5">
                             <div className="w-10 h-10 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--ink-700)] flex items-center justify-center font-bold text-[11px] shrink-0">
                               {userData?.avatar || ownerName.substring(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <p className="text-[13px] font-bold text-[var(--ink-900)]">{ownerName}</p>
                                <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{userData?.role || 'Client Lead'}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => removeOwner('clientOwners', ownerName)}
                            className="p-2 text-[var(--ink-300)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded-md opacity-0 group-hover:opacity-100 transition-all font-medium"
                          >
                             <X size={16} />
                          </button>
                       </div>
                     );
                   })}
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Target Criteria */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-6 space-y-6 bg-[var(--bg)]">
             <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--gc-orange-soft)] text-[var(--gc-orange)] flex items-center justify-center">
                <Target size={20} strokeWidth={2.5} />
              </div>
              <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Influencer Criteria</h3>
            </div>
            <div className="space-y-5">
              <textarea 
                name="influencerCriteria"
                value={activeCampaign.influencerCriteria || ''}
                onChange={handleInputChange}
                rows={5}
                className="w-full px-5 py-4 bg-[var(--white)] border border-[var(--border)] rounded-xl text-[13px] font-medium focus:border-[var(--gc-orange)] focus:ring-[4px] focus:ring-[var(--gc-orange-soft)] outline-none transition-all shadow-sm"
                placeholder="Define required age, gender, niche, cities, and follower ranges. Be specific about brand affinity."
              />
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                 <Info size={18} className="text-amber-500 flex-shrink-0" />
                 <p className="text-[9.5px] text-amber-700 leading-relaxed font-bold uppercase tracking-widest">These criteria will be used to calibrate the AI Discovery engine in Stage 6.</p>
              </div>
            </div>
          </section>

          {/* Section 6: Assets & Briefs */}
          <section className="bg-card border border-border rounded-xl overflow-hidden p-6 space-y-6 overflow-hidden relative bg-[var(--bg)]">
             <div className="absolute top-0 right-0 p-6 text-[var(--ink-500)] opacity-5">
                <FileText size={100} strokeWidth={1} />
             </div>
             <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--ink-100)] text-[var(--ink-600)] flex items-center justify-center border border-[var(--border)]">
                    <FileText size={20} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-display font-black uppercase text-[13px] tracking-widest text-[var(--ink-900)]">Mission Briefs</h3>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('brief-upload')?.click()}
                  className={cn(
                    "p-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 bg-[var(--white)] group cursor-pointer transition-all",
                    isDragging ? "border-[var(--gc-purple)] bg-[var(--gc-purple-soft)] scale-[1.02] shadow-[var(--shadow)]" : "border-[var(--border-strong)] hover:border-[var(--gc-purple)] hover:bg-[var(--gc-purple)]/5 hover:shadow-sm"
                  )}
                >
                   <input 
                     id="brief-upload"
                     type="file" 
                     className="hidden" 
                     onChange={handleFileSelect}
                     accept=".pdf,.docx,.key"
                   />
                   <div className={cn(
                     "w-14 h-14 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-sm flex items-center justify-center transition-colors",
                     isDragging ? "text-[var(--gc-purple)] bg-[var(--white)] border-[var(--gc-purple-soft)]" : "text-[var(--ink-400)] group-hover:text-[var(--gc-purple)] group-hover:bg-[var(--white)]"
                   )}>
                      <UploadCloud size={28} />
                   </div>
                   <div className="text-center">
                      <p className="text-[14px] font-bold text-[var(--ink-900)]">
                        {uploadingProgress !== null ? `Uploading... ${uploadingProgress}%` : 'Upload Brief Guidelines'}
                      </p>
                      <p className="text-[11px] text-[var(--ink-500)] mt-1.5 uppercase font-mono tracking-wider">PDF, DOCX, or Keynote (Max 10MB)</p>
                   </div>
                   {uploadingProgress !== null && (
                     <div className="w-48 h-1.5 bg-[var(--bg)] rounded-full mt-3 overflow-hidden border border-[var(--border)]">
                        <div 
                          className="h-full bg-[var(--gc-purple)] transition-all duration-300" 
                          style={{ width: `${uploadingProgress}%` }}
                        />
                     </div>
                   )}
                </div>

                <div className="space-y-3">
                   {uploadedFiles.map((file, idx) => (
                     <div key={idx} className="flex items-center justify-between p-4 bg-[var(--white)] border border-[var(--border)] rounded-xl hover:shadow-md hover:border-[var(--gc-purple-soft)] transition-all cursor-pointer group/file">
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black italic border transition-all shadow-sm",
                             file.type === 'PDF' ? "bg-red-50 text-red-600 border-red-200 group-hover/file:bg-red-600 group-hover/file:text-white" : "bg-[var(--gc-purple-soft)] text-[var(--gc-purple)] border-[var(--gc-purple)]/20 group-hover/file:bg-[var(--gc-purple)] group-hover/file:text-white"
                           )}>
                             {file.type}
                           </div>
                           <div>
                              <p className="text-[13px] font-bold text-[var(--ink-900)] line-clamp-1 group-hover/file:text-[var(--gc-purple)] transition-colors">{file.name}</p>
                              <p className="text-[10px] text-[var(--ink-500)] font-bold uppercase font-mono tracking-widest mt-0.5">{file.size} • {file.date}</p>
                           </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-[var(--ink-300)] hover:text-white hover:bg-[var(--danger)] rounded-lg transition-all"
                        >
                           <X size={16} />
                        </button>
                     </div>
                   ))}
                </div>
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
