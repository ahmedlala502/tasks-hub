/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Cloud,
  Key,
  Sliders,
  Database,
  ChevronRight,
  Save,
  Mail,
  Globe,
  Brain,
  Eye,
  EyeOff,
  FileSpreadsheet,
  ListChecks,
  Server,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useAuth } from '../App';
import { BulkUploadButton } from '../components/BulkUploadDialog';
import { adminApi } from '../services/adminApi';
import { dataService } from '../services/dataService';
import { cn } from '../utils';
import { AI_PROVIDER_PRESETS, AiProviderConfig, AiProviderId } from '../services/geminiService';
import {
  rowsToCampaigns,
  rowsToInfluencers,
  rowsToTasks,
  rowsToUsers,
  type UserImportRow,
} from '../services/spreadsheetService';
import type { Campaign, CampaignInfluencer, Task } from '../types';

const SETTING_SECTIONS = [
  { id: 'general', label: 'General Info', icon: Sliders },
  { id: 'security', label: 'Security & API', icon: Shield },
  { id: 'notifications', label: 'Alert Protocols', icon: Bell },
  { id: 'cloud', label: 'Cloud Resources', icon: Cloud },
  { id: 'bulk-upload', label: 'Bulk Upload Center', icon: UploadCloud, masterOnly: true },
];

const CAMPAIGN_TEMPLATE_HEADERS = [
  'Campaign Name',
  'Country',
  'Type',
  'Total List',
  'Confirmations',
  'Target',
  'Visited',
  'Coverage',
  'Approved',
  'Reject',
  'Daily Target',
  "Today's Visits",
  "Tomorrow's Visits",
  'Day After',
  'Start Date',
  'End Date',
  'Run Rate',
  '% of Target',
  'Conf Rate %',
  'Cov Rate %',
];

const DEFAULT_AI_PROVIDER: AiProviderConfig = {
  provider: 'gemini',
  model: AI_PROVIDER_PRESETS.gemini.model,
  endpoint: AI_PROVIDER_PRESETS.gemini.endpoint,
  apiKey: '',
  mode: 'demo',
  temperature: 0.35,
};

export default function SettingsWorkspace() {
  const { role } = useAuth();
  const isMaster = role === 'master';
  const [activeRoot, setActiveRoot] = useState('general');
  const [saved, setSaved] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('trygc-settings') || '{}');
      return {
        workspaceName: 'TRYGC Super Admin',
        defaultMarket: 'Saudi Arabia',
        timezone: 'Asia/Riyadh',
        language: 'EN / AR',
        approvalThreshold: '85',
        apiProvider: 'Google Gemini',
        apiMode: 'Demo until API key is configured',
        pinnedMessage: '',
        tickerDirection: 'left',
        ...(stored.settings || {})
      };
    } catch {
      return {
        workspaceName: 'TRYGC Super Admin',
        defaultMarket: 'Saudi Arabia',
        timezone: 'Asia/Riyadh',
        language: 'EN / AR',
        approvalThreshold: '85',
        apiProvider: 'Google Gemini',
        apiMode: 'Demo until API key is configured',
        pinnedMessage: '',
        tickerDirection: 'left',
      };
    }
  });
  const [aiProvider, setAiProvider] = useState<AiProviderConfig>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('trygc-settings') || '{}');
      return { ...DEFAULT_AI_PROVIDER, ...(stored.aiProvider || {}) };
    } catch {
      return DEFAULT_AI_PROVIDER;
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('trygc-supabase-url') || (import.meta.env.VITE_SUPABASE_URL as string) || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('trygc-supabase-key') || '');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
    firestore: true,
    dailyDigest: true,
    blockerEscalation: true,
    autoArchive: false,
    strictRbac: true,
  });
  const visibleSettingSections = useMemo(
    () => SETTING_SECTIONS.filter((section) => !section.masterOnly || isMaster),
    [isMaster],
  );
  const activeMeta = useMemo(
    () => visibleSettingSections.find((section) => section.id === activeRoot) ?? visibleSettingSections[0],
    [activeRoot, visibleSettingSections],
  );

  useEffect(() => {
    if (!visibleSettingSections.some((section) => section.id === activeRoot)) {
      setActiveRoot(visibleSettingSections[0]?.id ?? 'general');
    }
  }, [activeRoot, visibleSettingSections]);

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current: typeof settings) => ({ ...current, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem('trygc-settings', JSON.stringify({ settings, toggleStates, aiProvider }));
    if (supabaseUrl.trim()) localStorage.setItem('trygc-supabase-url', supabaseUrl.trim());
    if (supabaseKey.trim()) localStorage.setItem('trygc-supabase-key', supabaseKey.trim());
    setSaved(true);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1800) as unknown as number;
  };

  const selectProvider = (provider: AiProviderId) => {
    const preset = AI_PROVIDER_PRESETS[provider];
    setAiProvider((current) => ({
      ...current,
      provider,
      model: preset.model,
      endpoint: preset.endpoint,
      apiKey: '',
      mode: 'demo',
    }));
    setSettings((current: typeof settings) => ({
      ...current,
      apiProvider: preset.label,
      apiMode: preset.supportsSearch ? 'Search-grounded discovery' : 'Structured JSON discovery',
    }));
  };

  const updateAiProvider = <K extends keyof AiProviderConfig>(key: K, value: AiProviderConfig[K]) => {
    setAiProvider((current) => ({ ...current, [key]: value }));
  };

  const commitCampaigns = async (items: Campaign[]) => {
    const { inserted, updated } = dataService.upsertCampaigns(items);
    setBulkMessage(`Campaigns updated: ${inserted} added, ${updated} refreshed.`);
    return { inserted, updated };
  };

  const commitInfluencers = async (items: CampaignInfluencer[]) => {
    const { inserted, updated } = dataService.upsertInfluencers(items);
    setBulkMessage(`Influencers updated: ${inserted} added, ${updated} refreshed.`);
    return { inserted, updated };
  };

  const commitTasks = async (items: Task[]) => {
    const { inserted, updated } = dataService.upsertTasks(items);
    setBulkMessage(`Tasks updated: ${inserted} added, ${updated} refreshed.`);
    return { inserted, updated };
  };

  const commitUsers = async (items: UserImportRow[]) => {
    let inserted = 0;
    const errors: string[] = [];

    for (const user of items) {
      try {
        await adminApi.createUser({
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          office: user.office ?? 'Egypt',
          department: user.department as any,
          title: user.title,
        });
        inserted++;
      } catch (error) {
        errors.push(`${user.email}: ${error instanceof Error ? error.message : 'failed'}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Bulk user import errors', errors);
      setBulkMessage(`Users updated: ${inserted} added. ${errors.length} row needs review.`);
    } else {
      setBulkMessage(`Users updated: ${inserted} added.`);
    }

    return { inserted, updated: 0 };
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Administration</div>
          <h2 className="font-extrabold text-2xl tracking-tight text-foreground">System Configuration</h2>
          <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
            <SettingsIcon size={15} className="text-gc-orange" />
            Editable control center for platform variables, permissions, alerts, and integrations.
          </p>
        </div>
        <button
          onClick={saveSettings}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gc-orange/90"
        >
          <Save size={15} />
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-1">
          {visibleSettingSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveRoot(section.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-all font-bold text-[12px] border-l-2',
                activeRoot === section.id
                  ? 'bg-gc-orange/10 text-foreground border-gc-orange'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border-transparent'
              )}
            >
              <section.icon size={15} className={activeRoot === section.id ? 'text-gc-orange' : ''} />
              {section.label}
              {section.masterOnly && <span className="ml-auto rounded-full border border-gc-orange/30 bg-gc-orange/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-gc-orange">Master</span>}
              {activeRoot === section.id && <ChevronRight size={13} className="ml-auto text-gc-orange" />}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-5">
          <div className="bg-card border border-border rounded-xl border-t-2 border-t-gc-orange overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-muted/30">
              <p className="text-[10px] uppercase tracking-[1.4px] font-bold text-muted-foreground">Active Section</p>
              <h3 className="font-extrabold text-lg tracking-tight text-foreground">{activeMeta?.label}</h3>
            </div>
            <div className="p-6">
              {activeRoot === 'general' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditableField label="Workspace Name" value={settings.workspaceName} onChange={(value) => updateSetting('workspaceName', value)} />
                  <EditableField label="Default Market" value={settings.defaultMarket} onChange={(value) => updateSetting('defaultMarket', value)} />
                  <EditableField label="Timezone" value={settings.timezone} onChange={(value) => updateSetting('timezone', value)} />
                  <EditableField label="Language Mode" value={settings.language} onChange={(value) => updateSetting('language', value)} />
                  <EditableField label="Approval Threshold %" value={settings.approvalThreshold} onChange={(value) => updateSetting('approvalThreshold', value)} />
                  <ToggleCard title="Auto Archive Completed Campaigns" desc="Move closed campaigns into the archive after reporting is approved." value={toggleStates.autoArchive} onChange={() => flipToggle('autoArchive', setToggleStates)} />
                </div>
              )}

              {activeRoot === 'security' && (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI Discovery Provider</p>
                        <h4 className="text-sm font-bold text-foreground">Choose the engine used by AI Discovery</h4>
                      </div>
                      <span className={cn(
                        'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                        aiProvider.mode === 'live'
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-400'
                          : 'border-orange-200 bg-orange-50 text-gc-orange dark:border-orange-900/40 dark:bg-orange-900/20'
                      )}>
                        {aiProvider.mode}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(Object.keys(AI_PROVIDER_PRESETS) as AiProviderId[]).map((provider) => {
                        const preset = AI_PROVIDER_PRESETS[provider];
                        const active = aiProvider.provider === provider;
                        return (
                          <button
                            key={provider}
                            onClick={() => selectProvider(provider)}
                            className={cn(
                              'rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent',
                              active && 'border-gc-orange bg-gc-orange/10'
                            )}
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <Brain size={17} className={active ? 'text-gc-orange' : 'text-muted-foreground'} />
                              {active && <span className="h-2 w-2 rounded-full bg-gc-orange" />}
                            </div>
                            <p className="text-sm font-bold text-foreground">{preset.label}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{preset.model}</p>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {preset.supportsSearch ? 'Search-ready' : 'JSON mode'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border p-4">
                    <EditableField label="Model" value={aiProvider.model} onChange={(value) => updateAiProvider('model', value)} />
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mode</span>
                      <select
                        className="settings-input"
                        value={aiProvider.mode}
                        onChange={(event) => updateAiProvider('mode', event.target.value as AiProviderConfig['mode'])}
                      >
                        <option value="demo">Demo / Safe fallback</option>
                        <option value="live">Live provider API</option>
                      </select>
                    </label>
                    <EditableField label="Endpoint" value={aiProvider.endpoint} onChange={(value) => updateAiProvider('endpoint', value)} />
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">API Key</span>
                      <div className="flex gap-2">
                        <input
                          className="settings-input"
                          type={showKey ? 'text' : 'password'}
                          value={aiProvider.apiKey}
                          placeholder={AI_PROVIDER_PRESETS[aiProvider.provider].envKey}
                          onChange={(event) => updateAiProvider('apiKey', event.target.value)}
                        />
                        <button className="icon-btn" type="button" onClick={() => setShowKey((value) => !value)}>
                          {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Temperature: {aiProvider.temperature.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={aiProvider.temperature}
                        onChange={(event) => updateAiProvider('temperature', Number(event.target.value))}
                        className="w-full accent-[var(--gc-orange)]"
                      />
                    </label>
                  </div>

                  <div className="space-y-1 divide-y divide-border">
                    <SettingRow icon={<Key size={16} className="text-gc-orange" />} title="Provider Runtime" desc="AI Discovery reads these saved settings before each extraction." action={<span className="text-xs font-bold text-gc-orange">{AI_PROVIDER_PRESETS[aiProvider.provider].label}</span>} />
                    <SettingRow icon={<Shield size={16} className="text-gc-purple" />} title="Strict RBAC" desc="Require explicit role permission before edits, exports, and closures." toggle toggleKey="strictRbac" toggleStates={toggleStates} setToggleStates={setToggleStates} />
                    <SettingRow icon={<Database size={16} className="text-slate-500" />} title="Firestore Mirroring" desc="Sync local state with production Firebase instance." toggle toggleKey="firestore" toggleStates={toggleStates} setToggleStates={setToggleStates} />
                  </div>
                </div>
              )}

              {activeRoot === 'notifications' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ToggleCard title="Daily Operations Digest" desc="Send a campaign, coverage, QA, and blocker summary each morning." value={toggleStates.dailyDigest} onChange={() => flipToggle('dailyDigest', setToggleStates)} icon={<Mail size={17} />} />
                  <ToggleCard title="Blocker Escalation" desc="Escalate critical blockers after two hours without owner response." value={toggleStates.blockerEscalation} onChange={() => flipToggle('blockerEscalation', setToggleStates)} icon={<Bell size={17} />} />
                </div>
              )}

              {activeRoot === 'cloud' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricTile label="Local Storage" value={`${(Object.keys(localStorage).filter(k => k.startsWith('GC_')).reduce((acc, k) => acc + (localStorage.getItem(k)?.length ?? 0), 0) / 1024).toFixed(1)} KB`} detail="Workspace data keys" />
                    <MetricTile label="Read Health" value="99.8%" detail="Stable realtime sync" />
                    <MetricTile label="Markets Online" value="4" detail="KSA, UAE, EGY, KW" />
                  </div>

                  <div className="rounded-xl border border-border p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Server size={16} className="text-gc-orange" /> Supabase Connection
                    </div>
                    <p className="text-[11px] text-muted-foreground">Override the environment defaults. Changes saved here persist in localStorage and take effect on next page load.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <EditableField
                        label="Supabase Project URL"
                        value={supabaseUrl}
                        onChange={(v) => setSupabaseUrl(v)}
                      />
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supabase Anon Key</span>
                        <div className="flex gap-2">
                          <input
                            className="settings-input flex-1"
                            type={showSupabaseKey ? 'text' : 'password'}
                            value={supabaseKey}
                            placeholder="eyJhbGciO..."
                            onChange={(e) => setSupabaseKey(e.target.value)}
                          />
                          <button className="icon-btn" type="button" onClick={() => setShowSupabaseKey(v => !v)}>
                            {showSupabaseKey ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Database size={16} className="text-gc-orange" /> Local Storage Keys
                    </div>
                    <p className="text-[11px] text-muted-foreground">All workspace data stored in browser localStorage. Use the Export / Backup buttons in Admin to download a snapshot.</p>
                    {['GC_CAMPAIGNS', 'GC_INFLUENCERS', 'GC_BLOCKERS', 'GC_TASKS', 'GC_HANDOVERS', 'GC_NOTIFICATIONS', 'trygc-admin-access-center', 'trygc-settings'].map((key) => {
                      const raw = localStorage.getItem(key);
                      const sizeBytes = raw ? new TextEncoder().encode(raw).length : 0;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                          <span className="text-[11px] font-mono font-bold text-foreground truncate">{key}</span>
                          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                            {sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : 'Empty'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Globe size={16} className="text-gc-orange" /> Regional Routing
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Production-ready controls for market routing, Firebase project mapping, and export destinations.</p>
                  </div>
                </div>
              )}

              {activeRoot === 'bulk-upload' && isMaster && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-gc-orange/25 bg-gc-orange/5 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[1.4px] text-gc-orange">Master Only</p>
                        <h4 className="text-sm font-extrabold text-foreground">Central Bulk Upload Center</h4>
                        <p className="mt-1 text-xs text-muted-foreground">Upload approved templates for pages that support bulk import. Campaigns use the attached tracker sequence as the main template.</p>
                      </div>
                      <UploadCloud size={22} className="text-gc-orange" />
                    </div>
                  </div>

                  {bulkMessage && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[12px] font-bold text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                      {bulkMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BulkUploadTile
                      icon={<FileSpreadsheet size={18} />}
                      title="Campaigns"
                      description="Imports campaign tracker rows with target, confirmations, coverage, visits, approvals, and rates."
                      action={
                        <BulkUploadButton<Campaign>
                          title="Bulk Import Campaigns"
                          templateHeaders={CAMPAIGN_TEMPLATE_HEADERS}
                          parse={rowsToCampaigns}
                          validate={(campaign) => {
                            const errs: string[] = [];
                            if (!campaign.name) errs.push('Missing campaign name');
                            if (!campaign.country) errs.push('Missing country');
                            return errs;
                          }}
                          commit={commitCampaigns}
                        />
                      }
                    />
                    <BulkUploadTile
                      icon={<ListChecks size={18} />}
                      title="Tasks"
                      description="Imports task owners, due dates, priorities, statuses, and campaign links."
                      action={
                        <BulkUploadButton<Task>
                          title="Bulk Import Tasks"
                          templateHeaders={['id','title','description','ownerId','dueDate','campaignId','priority','status','department','category']}
                          parse={rowsToTasks}
                          validate={(task) => {
                            const errs: string[] = [];
                            if (!task.title) errs.push('Missing title');
                            if (!task.ownerId) errs.push('Missing ownerId');
                            return errs;
                          }}
                          commit={commitTasks}
                        />
                      }
                    />
                    <BulkUploadTile
                      icon={<Users size={18} />}
                      title="Influencers"
                      description="Imports influencer campaign rosters, visit status, QA status, owner, city, and coverage fields."
                      action={
                        <BulkUploadButton<CampaignInfluencer>
                          title="Bulk Import Influencers"
                          templateHeaders={['id','campaignId','influencerId','username','platform','status','city','country','niche','followerRange','ownerId']}
                          parse={rowsToInfluencers}
                          validate={(influencer) => {
                            const errs: string[] = [];
                            if (!influencer.username) errs.push('Missing username');
                            if (!influencer.campaignId) errs.push('Missing campaignId');
                            return errs;
                          }}
                          commit={commitInfluencers}
                        />
                      }
                    />
                    <BulkUploadTile
                      icon={<Shield size={18} />}
                      title="Users"
                      description="Creates workspace access accounts from email, name, password, role, office, department, and title."
                      action={
                        <BulkUploadButton<UserImportRow>
                          title="Bulk Import Users"
                          templateHeaders={['email','name','password','role','office','department','title']}
                          parse={rowsToUsers}
                          validate={(user) => {
                            const errs: string[] = [];
                            if (!user.email || !/.+@.+\..+/.test(user.email)) errs.push('Invalid email');
                            if (!user.name) errs.push('Missing name');
                            if (!user.password || user.password.length < 8) errs.push('Password must be 8+ chars');
                            return errs;
                          }}
                          commit={commitUsers}
                        />
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkUploadTile({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-gc-orange/10 p-2 text-gc-orange">{icon}</div>
        <div>
          <h4 className="text-sm font-extrabold text-foreground">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EditableField({ label, value, onChange, compact }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <label className={cn("block", compact && "min-w-44")}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input className="settings-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SettingRow({ icon, title, desc, action, toggle, toggleKey, toggleStates, setToggleStates }: any) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 first:pt-0 last:border-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="ml-4 flex-shrink-0">
        {action}
        {toggle && <Switch checked={toggleStates[toggleKey]} onChange={() => flipToggle(toggleKey, setToggleStates)} />}
      </div>
    </div>
  );
}

function ToggleCard({ title, desc, value, onChange, icon }: { title: string; desc: string; value: boolean; onChange: () => void; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {icon && <div className="text-gc-orange mt-0.5">{icon}</div>}
          <div>
            <h4 className="text-sm font-bold text-foreground">{title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          </div>
        </div>
        <Switch checked={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn('w-11 h-6 rounded-full relative transition-colors p-0.5', checked ? 'bg-gc-orange' : 'bg-border')}>
      <div className={cn('w-5 h-5 bg-white rounded-full shadow-sm transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function flipToggle(key: string, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) {
  setter((current) => ({ ...current, [key]: !current[key] }));
}
