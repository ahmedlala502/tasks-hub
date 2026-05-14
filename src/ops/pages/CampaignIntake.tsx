import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ArrowRight, PlusCircle, X } from 'lucide-react';
import { CampaignStage } from '../constants';
import { validateCampaign, cn } from '../utils';
import { Campaign } from '../types';
import { dataService } from '../services/dataService';
import { notify } from '../services/notificationService';
import { adminApi } from '../services/adminApi';
import { useAuth } from '../App';
import type { OpsUser } from '../auth/types';

const OWNER_COLORS = ['bg-gc-orange', 'bg-gc-purple', 'bg-emerald-500', 'bg-sky-500', 'bg-rose-500'];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '??';
}

export default function CampaignIntake() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<OpsUser[]>([]);
  const [strategicOwners, setStrategicOwners] = useState<string[]>(['']);
  const [formData, setFormData] = useState<Partial<Campaign>>({
    stage: CampaignStage.INTAKE,
    status: 'Active',
    platforms: [],
    internalOwners: [],
    clientOwners: [],
  });

  useEffect(() => {
    let alive = true;
    adminApi
      .listUsers()
      .then(users => {
        if (alive) setEmployees(users.filter(u => u.status === 'active'));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const { isValid, missingFields } = validateCampaign(formData);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleTogglePlatform = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms?.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...(prev.platforms || []), platform],
    }));
  };

  const handleDeploy = () => {
    if (!isValid) return;
    const ownerNames = strategicOwners.map(s => s.trim()).filter(Boolean);
    const creatorName = user?.displayName || user?.email || 'admin';
    const newCampaign: Campaign = {
      ...(formData as Campaign),
      id: `C-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: creatorName,
      internalOwners: Array.from(new Set([creatorName, ...ownerNames])),
      recordHealth: 'Healthy',
      currentOwner: ownerNames[0] || creatorName,
      nextAction: 'Validate campaign data',
    };
    dataService.addCampaign(newCampaign);
    notify('Campaign Created', `"${newCampaign.name}" added to the registry`, 'green', '/campaigns');
    navigate('/campaigns');
  };

  const inputClass = "w-full px-4 py-3 bg-background border border-border rounded-lg text-[13px] font-medium text-foreground outline-none focus:ring-2 focus:ring-gc-orange/30 focus:border-gc-orange transition-all placeholder:text-muted-foreground/40";
  const labelClass = "block text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1.5";

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Stage 01: Initiation</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Campaign Intake</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Enter core mission parameters to initialize the validation phase.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/campaigns')}
            className="px-5 py-2.5 text-[11px] font-condensed font-bold uppercase tracking-widest border border-border rounded-lg bg-card shadow-sm hover:bg-accent transition-all text-foreground"
          >
            Save Draft
          </button>
          <button
            onClick={handleDeploy}
            disabled={!isValid}
            className="px-5 py-2.5 text-[11px] font-condensed font-bold uppercase tracking-widest bg-gc-orange text-white rounded-lg hover:bg-gc-orange/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm group"
          >
            Deploy Mission
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-5">
          {/* Section 01: Logistics & Identity */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-6">
            <SectionHeader num="01" title="Logistics & Identity" />
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Campaign Name *</label>
                <input name="name" onChange={handleInputChange} className={inputClass} placeholder="e.g. MISSION: SUMMER LAUNCH" />
              </div>
              <div>
                <label className={labelClass}>Client / Brand *</label>
                <select name="clientId" onChange={handleInputChange} className={inputClass}>
                  <option value="">Select client...</option>
                  <option value="c1">Red Bull (KSA Operations)</option>
                  <option value="c2">Almarai (Regional Hub)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Primary Market *</label>
                <input name="country" onChange={handleInputChange} className={inputClass} placeholder="Saudi Arabia" />
              </div>
              <div>
                <label className={labelClass}>Operational Hub *</label>
                <input name="city" onChange={handleInputChange} className={inputClass} placeholder="Riyadh / Jeddah" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Campaign Type *</label>
                <select name="type" onChange={handleInputChange} className={inputClass}>
                  <option value="">Select type...</option>
                  <option value="Influencer Marketing">Influencer Marketing</option>
                  <option value="Performance">Performance</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 02: Objectives & Financials */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-6">
            <SectionHeader num="02" title="Objectives & Financials" />
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Target Influencers *</label>
                <input type="number" name="targetInfluencers" onChange={handleInputChange} className={inputClass} placeholder="50" />
              </div>
              <div>
                <label className={labelClass}>Target Posting Vol. *</label>
                <input type="number" name="targetPostingCoverage" onChange={handleInputChange} className={inputClass} placeholder="100" />
              </div>
              <div>
                <label className={labelClass}>Budget *</label>
                <input type="number" name="budget" onChange={handleInputChange} className={inputClass} placeholder="50000" />
              </div>
              <div>
                <label className={labelClass}>Currency *</label>
                <select name="budgetType" onChange={handleInputChange} className={inputClass}>
                  <option value="USD">USD</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Start Date *</label>
                <input type="date" name="startDate" onChange={handleInputChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End Date *</label>
                <input type="date" name="endDate" onChange={handleInputChange} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Campaign Objective *</label>
                <input name="objective" onChange={handleInputChange} className={inputClass} placeholder="e.g. Brand Awareness, User Acquisition" />
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className={labelClass}>Delivery Platforms *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['Instagram', 'TikTok', 'Snapchat', 'YouTube'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleTogglePlatform(p)}
                    className={cn(
                      'px-4 py-2 text-[11px] font-condensed font-bold uppercase tracking-widest rounded-lg border-2 transition-all',
                      formData.platforms?.includes(p)
                        ? 'bg-foreground border-foreground text-background'
                        : 'bg-card border-border text-muted-foreground hover:border-gc-orange hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Section 03: Creative Brief */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-5">
            <SectionHeader num="03" title="Creative Brief" />
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className={labelClass}>Deliverables *</label>
                <input name="deliverables" onChange={handleInputChange} className={inputClass} placeholder="e.g. 2 Stories, 1 Reel" />
              </div>
              <div>
                <label className={labelClass}>Mandatory Tags *</label>
                <input name="tags" onChange={handleInputChange} className={inputClass} placeholder="#CampaignTag" />
              </div>
              <div>
                <label className={labelClass}>Mandatory Mentions</label>
                <input name="mentions" onChange={handleInputChange} className={inputClass} placeholder="@brand" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Product Details *</label>
                <textarea name="productDetails" onChange={handleInputChange} rows={3} className={cn(inputClass, 'resize-none')} placeholder="Describe the product or service..." />
              </div>
              <div>
                <label className={labelClass}>Influencer Criteria *</label>
                <input name="influencerCriteria" onChange={handleInputChange} className={inputClass} placeholder="e.g. Gen Z, Outdoor lifestyle" />
              </div>
              <div>
                <label className={labelClass}>Restrictions</label>
                <input name="restrictions" onChange={handleInputChange} className={inputClass} placeholder="e.g. No competitors" />
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          {/* Integrity Gate */}
          <div className={cn(
            'bg-card border rounded-xl p-6 relative overflow-hidden transition-all duration-500',
            isValid ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'
          )}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-condensed font-bold text-[11px] uppercase tracking-widest text-foreground">Integrity Gate</h4>
              <div className={cn(
                'w-3 h-3 rounded-full transition-all',
                isValid ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-border'
              )} />
            </div>

            {!isValid ? (
              <div className="space-y-4">
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Cannot proceed to <span className="text-foreground font-bold">Ready for Setup</span> until critical fields are filled:
                </p>
                <div className="space-y-2 bg-background p-4 rounded-lg border border-border">
                  {missingFields.slice(0, 8).map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-destructive rounded-full shrink-0" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                  {missingFields.length > 8 && (
                    <div className="text-[10px] font-mono text-muted-foreground/60 pl-3.5">
                      +{missingFields.length - 8} more fields
                    </div>
                  )}
                </div>
                <div className="p-4 bg-destructive/8 rounded-lg border border-destructive/20 flex gap-3">
                  <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-[11px] text-destructive/90 italic leading-relaxed">"Mission integrity must be complete before cluster deployment."</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={28} />
                </div>
                <p className="text-[15px] font-bold text-foreground">Integrity Check Passed.</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  All tactical entities detected. System is green for Stage 02: Verification Hub.
                </p>
                <div className="pt-4 border-t border-emerald-500/20">
                  <p className="text-[9.5px] font-condensed font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Authorized for Deployment</p>
                </div>
              </div>
            )}
          </div>

          {/* Created By & Owners */}
          <div className="bg-foreground rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 pointer-events-none opacity-5">
              <PlusCircle size={120} className="text-white" />
            </div>
            <h4 className="font-condensed font-bold text-[10px] uppercase tracking-widest text-background/50 mb-5">Created By &amp; Owners</h4>
            <div className="space-y-4 relative z-10">
              {/* Creator (current user, read-only) */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gc-orange flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                  {getInitials(user?.displayName || user?.email || 'NA')}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-background truncate">{user?.displayName || user?.email || 'Current user'}</p>
                  <p className="text-[9.5px] font-mono uppercase tracking-widest text-background/50 mt-0.5">Created By</p>
                </div>
              </div>

              {/* Strategic owner dropdowns */}
              {strategicOwners.map((selected, idx) => {
                const employee = employees.find(e => e.displayName === selected);
                const color = OWNER_COLORS[(idx + 1) % OWNER_COLORS.length];
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${employee ? color : 'bg-background/10'} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>
                      {employee ? getInitials(employee.displayName) : '?'}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <select
                        value={selected}
                        onChange={e =>
                          setStrategicOwners(prev => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        className="flex-1 min-w-0 px-3 py-2 bg-background/10 border border-background/15 rounded-lg text-[12px] font-medium text-background outline-none focus:ring-2 focus:ring-gc-orange/40 transition-all"
                      >
                        <option value="" className="text-foreground">Select strategic owner…</option>
                        {employees
                          .filter(emp => emp.displayName === selected || !strategicOwners.includes(emp.displayName))
                          .map(emp => (
                            <option key={emp.uid} value={emp.displayName} className="text-foreground">
                              {emp.displayName}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setStrategicOwners(prev => prev.filter((_, i) => i !== idx))}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-background/60 hover:text-background hover:bg-background/10 transition-colors flex-shrink-0"
                        aria-label="Remove owner"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setStrategicOwners(prev => [...prev, ''])}
                className="w-full mt-2 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-background/10 transition-colors border border-background/15"
              >
                <PlusCircle size={14} className="text-gc-orange" />
                <span className="text-[10px] font-condensed font-bold uppercase tracking-widest text-background/70">Add Strategic Owner</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] font-condensed font-bold text-muted-foreground">
        {num}
      </div>
      <h3 className="font-condensed font-bold text-[12px] uppercase tracking-widest text-foreground">{title}</h3>
    </div>
  );
}
