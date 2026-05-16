import React from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Users, 
  Download,
  Share2,
  MoreVertical,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Camera,
  PlayCircle,
  X,
  Pencil,
  Save,
  Trash2,
  Upload
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../utils';
import { dataService } from '../services/dataService';
import { STAGE_NAMES } from '../constants';
import { Campaign, Task } from '../types';
import { exportCampaigns, readSpreadsheet } from '../services/spreadsheetService';

const MILESTONES = [
  { stage: 'TRYGC Intake', status: 'completed', date: 'Brief' },
  { stage: 'Client Confirmation', status: 'completed', date: 'Approval' },
  { stage: 'Influencer List', status: 'completed', date: 'Sourcing' },
  { stage: 'Invitation & Confirmation', status: 'active', date: 'CON', progress: 65 },
  { stage: 'Visit / Delivery Scheduling', status: 'pending', date: 'Schedule' },
  { stage: 'Execution & Coverage', status: 'pending', date: 'COV' },
  { stage: 'QA Review', status: 'pending', date: 'Quality' },
  { stage: 'Client Report & Closure', status: 'pending', date: 'Report' },
];

const CONTENT_FEED = [
  { id: 1, influencer: '@tech_omar', platform: 'Instagram', type: 'Reel', status: 'Approved', coverage: '42K', velocity: '9.2%' },
  { id: 2, influencer: '@lifestyle_sa', platform: 'TikTok', type: 'Video', status: 'Reviewing', coverage: '128K', velocity: '12.4%' },
  { id: 3, influencer: '@riyadh_explorer', platform: 'Instagram', type: 'Stories', status: 'Pending', coverage: '12K', velocity: '-' },
  { id: 4, influencer: '@fashion.mona', platform: 'Snapchat', type: 'Spotlight', status: 'Rejected', coverage: '5K', velocity: '2.1%' },
];

type ContentFeedItem = typeof CONTENT_FEED[number];

const INITIAL_VISIT_LOGS = [
  { influencer: '@lifestyle_sa', time: 'Nov 02, 14:00', location: 'Riyadh Core Hub', notes: 'Needs VIP parking access' },
  { influencer: '@tech_omar', time: 'Nov 04, 10:30', location: 'Jeddah Remote Studio', notes: 'Delivery signature required' },
];

type AuditFinding = {
  title: string;
  detail: string;
  owner: string;
  tone: 'green' | 'orange' | 'red';
};

export default function CampaignDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [visitLogs, setVisitLogs] = React.useState(INITIAL_VISIT_LOGS);
  const [contentFeed, setContentFeed] = React.useState<ContentFeedItem[]>(CONTENT_FEED);
  const [contentBulkMessage, setContentBulkMessage] = React.useState('');
  const contentUploadRef = React.useRef<HTMLInputElement | null>(null);
  const [isEntryOpen, setIsEntryOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'influencers' | 'media' | 'performance'>('overview');
  const [isEditingCampaign, setIsEditingCampaign] = React.useState(false);
  const [isAuditOpen, setIsAuditOpen] = React.useState(false);
  const [expandedWorkId, setExpandedWorkId] = React.useState<string | null>(null);
  const [draftCampaign, setDraftCampaign] = React.useState<Campaign | null>(null);
  const [ownerDraft, setOwnerDraft] = React.useState('');
  const [newEntry, setNewEntry] = React.useState({ influencer: '@', time: 'Nov 10, 14:00', location: 'Riyadh', notes: '' });
  
  const campaign = React.useMemo(() => {
    return dataService.getCampaigns().find(c => c.id === id);
  }, [id, refreshToken]);

  const campaignInfluencers = React.useMemo(() => {
    return dataService.getInfluencers().filter((influencer) =>
      influencer.campaignId === id ||
      influencer.campaignId === campaign?.id ||
      influencer.campaignId === campaign?.name
    );
  }, [id, campaign?.id, campaign?.name, refreshToken]);

  const campaignTasks = React.useMemo(() => {
    if (!campaign) return [] as Task[];
    return dataService.getTasks()
      .filter((task) => task.campaignId === campaign.id || task.campaignId === campaign.name || task.campaignId === id)
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  }, [campaign, id, refreshToken]);

  const campaignUpdates = React.useMemo(() => {
    if (!campaign) return [];
    const tokens = [campaign.id, campaign.name, id].filter(Boolean).map((value) => String(value).toLowerCase());
    return dataService.getActivityLogs()
      .filter((event) => {
        const haystack = `${event.summary || ''} ${event.entityId || ''} ${JSON.stringify(event.metadata || {})}`.toLowerCase();
        return tokens.some((token) => haystack.includes(token));
      })
      .slice(0, 12);
  }, [campaign, id, refreshToken]);

  const campaignWorkItems = React.useMemo(() => {
    const taskItems = campaignTasks.map((task) => ({
      id: `task-${task.id}`,
      type: task.dailyTaskKey || task.cadence ? 'Routine' : 'Task',
      title: task.title,
      owner: task.ownerId || 'Unassigned',
      status: task.completed ? 'Done' : task.status || 'In Progress',
      due: task.dueDate,
      details: task.description || task.nextStep || task.resultSummary || 'No additional task notes.',
      sla: task.slaHrs ? `${task.slaHrs}h` : 'Tracked by due date',
      updatedAt: task.updatedAt || task.createdAt,
    }));
    const updateItems = campaignUpdates.map((event) => ({
      id: `update-${event.id}`,
      type: 'Update',
      title: event.summary || event.action,
      owner: event.userName || event.userEmail || 'Workspace',
      status: event.action,
      due: new Date(event.createdAt).getTime(),
      details: JSON.stringify(event.metadata || {}, null, 2),
      sla: 'Activity log',
      updatedAt: new Date(event.createdAt).getTime(),
    }));
    return [...taskItems].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [campaignTasks]);

  React.useEffect(() => {
    if (campaign) setDraftCampaign(campaign as Campaign);
  }, [campaign]);

  React.useEffect(() => {
    if (campaign?.approvedContent?.length) setContentFeed(campaign.approvedContent);
    else setContentFeed(CONTENT_FEED);
  }, [campaign?.id]);

  React.useEffect(() => {
    setOwnerDraft(campaign?.currentOwner || '');
  }, [campaign?.currentOwner]);

  const ownerOptions = React.useMemo(() => {
    return ['PMO', 'Community', 'Coordination', 'Coverage', 'QA', 'Reporting', 'Finance', 'Operations', 'Ops Team'];
  }, []);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <h2 className="text-2xl font-black text-[var(--ink-400)] uppercase tracking-widest">Mission ID Not Found</h2>
        <button onClick={() => navigate('/campaigns')} className="bg-gc-orange text-white px-4 py-2.5 rounded-lg font-condensed font-bold uppercase tracking-wide hover:bg-gc-orange/90 transition-colors">Return to Registry</button>
      </div>
    );
  }

  const addVisitEntry = () => {
    if (!newEntry.influencer.trim() || newEntry.influencer.trim() === '@') return;
    setVisitLogs(prev => [{ ...newEntry, influencer: newEntry.influencer.startsWith('@') ? newEntry.influencer : `@${newEntry.influencer}` }, ...prev]);
    setIsEntryOpen(false);
    setNewEntry({ influencer: '@', time: 'Nov 10, 14:00', location: 'Riyadh', notes: '' });
  };

  const saveCampaignUpdates = () => {
    if (!campaign || !draftCampaign) return;
    dataService.updateCampaign(campaign.id, draftCampaign);
    setRefreshToken(prev => prev + 1);
    setIsEditingCampaign(false);
  };

  const deleteCampaign = () => {
    if (!campaign) return;
    const confirmed = window.confirm('Delete this campaign permanently?');
    if (!confirmed) return;
    dataService.deleteCampaign(campaign.id);
    navigate('/campaigns');
  };

  const removeVisitEntry = (index: number) => {
    setVisitLogs(prev => prev.filter((_, i) => i !== index));
  };

  const updateVisitEntry = (index: number, field: 'influencer' | 'time' | 'location' | 'notes', value: string) => {
    setVisitLogs(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  };

  const saveContentFeed = (next: ContentFeedItem[]) => {
    setContentFeed(next);
    if (campaign) dataService.updateCampaign(campaign.id, { approvedContent: next });
  };

  const removeContentEntry = (id: number) => {
    saveContentFeed(contentFeed.filter(item => item.id !== id));
  };

  const addContentEntry = () => {
    const nextId = Math.max(0, ...contentFeed.map((item) => item.id)) + 1;
    saveContentFeed([{ id: nextId, influencer: '@', platform: 'Instagram', type: 'Story', status: 'Pending', coverage: '-', velocity: '-' }, ...contentFeed]);
  };

  const updateContentEntry = (id: number, field: Exclude<keyof ContentFeedItem, 'id'>, value: string) => {
    saveContentFeed(contentFeed.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const bulkUploadContent = async (file: File | null) => {
    if (!file) return;
    const rows = await readSpreadsheet(file);
    const pick = (row: Record<string, any>, keys: string[], fallback = '') => {
      const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]));
      for (const key of keys) {
        const value = normalized[key.toLowerCase().replace(/[^a-z0-9]/g, '')];
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
      }
      return fallback;
    };
    const imported = rows.map((row, index) => ({
      id: Date.now() + index,
      influencer: pick(row, ['Influencer', 'Influencer Asset', 'Username', 'Handle', 'Creator'], '@'),
      platform: pick(row, ['Platform'], 'Instagram'),
      type: pick(row, ['Type', 'Content Type', 'Asset Type'], 'Story'),
      status: pick(row, ['Status', 'Approval', 'QA Status'], 'Approved'),
      coverage: pick(row, ['Coverage', 'Coverage Sync', 'Reach'], '-'),
      velocity: pick(row, ['Velocity', 'Rate', 'Engagement'], '-'),
    })).filter((row) => row.influencer && row.influencer !== '@');

    if (imported.length) {
      saveContentFeed(imported);
      setContentBulkMessage(`${imported.length} approved influencer / content rows loaded.`);
    } else {
      setContentBulkMessage('No usable approved influencer rows found.');
    }
    if (contentUploadRef.current) contentUploadRef.current.value = '';
  };

  const saveOwnerAssignment = () => {
    if (!campaign || !ownerDraft.trim()) return;
    dataService.updateCampaign(campaign.id, { currentOwner: ownerDraft.trim() });
    setRefreshToken((prev) => prev + 1);
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const trackerCoverage = campaign.coverage ?? campaignInfluencers.filter(item => item.coverageReceived).length;
  const trackerVisited = campaign.visited ?? campaignInfluencers.filter(item => item.visitCompleted).length;
  const trackerMissed = Math.max((campaign.targetInfluencers || 0) - trackerVisited, 0);
  const audit = buildTrygcAudit(campaign, {
    confirmations: campaign.confirmations || 0,
    coverage: trackerCoverage,
    visited: trackerVisited,
    missed: trackerMissed,
    approved: campaign.approved || 0,
    reject: campaign.reject || 0,
  });
  const campaignStats = [
    { label: 'Target', value: String(campaign.targetInfluencers || 0), change: 'Plan', sub: `${campaign.targetPostingCoverage || 0} coverage target` },
    { label: 'Coverage', value: String(trackerCoverage), change: 'Live', sub: 'Tracker coverage' },
    { label: 'Visited', value: String(trackerVisited), change: 'Done', sub: 'Completed visits' },
    { label: 'Missed', value: String(trackerMissed), change: 'Review', sub: 'Target minus visited' },
  ];

  return (
    <div className="max-w-[1240px] mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Precision Header */}
      <header className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
           <button 
             onClick={() => navigate('/campaigns')}
             className="group flex items-center gap-4 text-[var(--ink-400)] hover:text-[var(--ink-900)] transition-colors"
           >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center group-hover:bg-[var(--ink-900)] group-hover:text-white group-hover:border-[var(--ink-900)] transition-all shadow-sm">
                 <ArrowLeft size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest">Exit to Registry</span>
           </button>

           <div className="flex items-center gap-4">
              <button className="px-6 py-3.5 bg-[var(--white)] border border-[var(--border-strong)] text-[var(--ink-700)] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--bg)] transition-all flex items-center gap-2 shadow-sm">
                 <Share2 size={16} /> Global Link
              </button>
              <button onClick={() => exportCampaigns([campaign])} className="px-6 py-3.5 bg-gc-orange text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gc-orange/90 shadow-[var(--shadow-md)] transition-all flex items-center gap-2">
                 <Download size={16} /> Export Report
              </button>
              {isEditingCampaign ? (
                <button
                  onClick={saveCampaignUpdates}
                  className="px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-[var(--shadow-md)] transition-all flex items-center gap-2"
                >
                  <Save size={16} /> Save
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingCampaign(true)}
                  className="px-6 py-3.5 bg-[var(--white)] border border-[var(--border-strong)] text-[var(--ink-700)] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--bg)] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Pencil size={16} /> Edit
                </button>
              )}
              <button
                onClick={deleteCampaign}
                className="w-12 h-12 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors shadow-sm"
                title="Delete campaign"
              >
                 <Trash2 size={18} />
              </button>
              <button className="w-12 h-12 bg-[var(--white)] border border-[var(--border-strong)] text-[var(--ink-500)] rounded-xl flex items-center justify-center hover:bg-[var(--bg)] hover:text-[var(--ink-900)] transition-colors shadow-sm">
                 <MoreVertical size={20} />
              </button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="px-3.5 py-1.5 bg-[var(--gc-orange-soft)] text-[var(--gc-orange)] rounded-lg text-[11px] font-black uppercase tracking-widest">
                    {STAGE_NAMES[campaign.stage as keyof typeof STAGE_NAMES] || 'Execution Phase'}
                 </div>
                 <div className="w-1.5 h-1.5 rounded-full bg-[var(--ink-300)]" />
                 <span className="text-[11px] font-black uppercase tracking-widest text-[var(--ink-400)]">ID: {campaign.id}</span>
              </div>
              {isEditingCampaign && draftCampaign ? (
                <div className="space-y-3 max-w-[980px]">
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--white)] px-4 py-3 text-2xl font-black text-[var(--ink-900)] outline-none focus:border-gc-orange"
                    value={draftCampaign.name}
                    onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, name: event.target.value } : prev)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className="settings-input" value={draftCampaign.city || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, city: event.target.value } : prev)} placeholder="City" />
                    <input className="settings-input" value={draftCampaign.country || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, country: event.target.value } : prev)} placeholder="Country" />
                    <input className="settings-input" value={draftCampaign.type || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, type: event.target.value } : prev)} placeholder="Type" />
                    <input className="settings-input" value={draftCampaign.startDate || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, startDate: event.target.value } : prev)} placeholder="Start date" />
                    <input className="settings-input" value={draftCampaign.endDate || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, endDate: event.target.value } : prev)} placeholder="End date" />
                    <input className="settings-input" type="number" value={draftCampaign.targetInfluencers || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, targetInfluencers: Number(event.target.value) } : prev)} placeholder="Target influencers" />
                    <input className="settings-input" type="number" value={draftCampaign.targetPostingCoverage || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, targetPostingCoverage: Number(event.target.value) } : prev)} placeholder="Coverage target" />
                    <input className="settings-input" type="number" value={draftCampaign.totalList || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, totalList: Number(event.target.value) } : prev)} placeholder="Total list" />
                    <input className="settings-input" type="number" value={draftCampaign.confirmations || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, confirmations: Number(event.target.value) } : prev)} placeholder="Confirmations" />
                    <input className="settings-input" type="number" value={draftCampaign.visited || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, visited: Number(event.target.value) } : prev)} placeholder="Visited" />
                    <input className="settings-input" type="number" value={draftCampaign.coverage || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, coverage: Number(event.target.value), targetPostingCoverage: Number(event.target.value) } : prev)} placeholder="Coverage" />
                    <input className="settings-input" type="number" value={draftCampaign.approved || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, approved: Number(event.target.value) } : prev)} placeholder="Approved" />
                    <input className="settings-input" type="number" value={draftCampaign.reject || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, reject: Number(event.target.value) } : prev)} placeholder="Reject" />
                    <input className="settings-input" type="number" value={draftCampaign.dailyTarget || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, dailyTarget: Number(event.target.value) } : prev)} placeholder="Daily target" />
                    <input className="settings-input" type="number" value={draftCampaign.todaysVisits || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, todaysVisits: Number(event.target.value) } : prev)} placeholder="Today's visits" />
                    <input className="settings-input" type="number" value={draftCampaign.tomorrowsVisits || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, tomorrowsVisits: Number(event.target.value) } : prev)} placeholder="Tomorrow's visits" />
                    <input className="settings-input" type="number" value={draftCampaign.dayAfterVisits || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, dayAfterVisits: Number(event.target.value) } : prev)} placeholder="Day after" />
                    <input className="settings-input" type="number" value={draftCampaign.runRate || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, runRate: Number(event.target.value) } : prev)} placeholder="Run rate" />
                    <input className="settings-input" type="number" value={draftCampaign.targetRate || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, targetRate: Number(event.target.value) } : prev)} placeholder="% of target" />
                    <input className="settings-input" type="number" value={draftCampaign.confirmationRate || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, confirmationRate: Number(event.target.value) } : prev)} placeholder="Conf rate %" />
                    <input className="settings-input" type="number" value={draftCampaign.coverageRate || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, coverageRate: Number(event.target.value) } : prev)} placeholder="Cov rate %" />
                    <input className="settings-input" type="number" value={draftCampaign.budget || 0} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, budget: Number(event.target.value) } : prev)} placeholder="Budget" />
                    <input className="settings-input" value={draftCampaign.budgetType || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, budgetType: event.target.value } : prev)} placeholder="Budget type" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select className="settings-input" value={draftCampaign.status || 'Active'} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, status: event.target.value as Campaign['status'] } : prev)}>
                      {['Active', 'Blocked', 'Closed', 'On Hold'].map(status => <option key={status}>{status}</option>)}
                    </select>
                    <select className="settings-input" value={draftCampaign.recordHealth || 'Healthy'} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, recordHealth: event.target.value as Campaign['recordHealth'] } : prev)}>
                      {['Healthy', 'At Risk', 'Critical'].map(health => <option key={health}>{health}</option>)}
                    </select>
                    <input className="settings-input" value={draftCampaign.currentOwner || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, currentOwner: event.target.value } : prev)} placeholder="Current owner" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <textarea className="settings-input min-h-20" value={draftCampaign.objective || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, objective: event.target.value } : prev)} placeholder="Objective" />
                    <textarea className="settings-input min-h-20" value={draftCampaign.deliverables || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, deliverables: event.target.value } : prev)} placeholder="Deliverables" />
                    <textarea className="settings-input min-h-20" value={draftCampaign.productDetails || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, productDetails: event.target.value } : prev)} placeholder="Product / visit details" />
                    <textarea className="settings-input min-h-20" value={draftCampaign.influencerCriteria || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, influencerCriteria: event.target.value } : prev)} placeholder="Influencer criteria" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className="settings-input" value={draftCampaign.tags || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, tags: event.target.value } : prev)} placeholder="Tags" />
                    <input className="settings-input" value={draftCampaign.mentions || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, mentions: event.target.value } : prev)} placeholder="Mentions" />
                    <input className="settings-input" value={draftCampaign.links || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, links: event.target.value } : prev)} placeholder="Links" />
                    <input className="settings-input" value={draftCampaign.reportingCadence || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, reportingCadence: event.target.value } : prev)} placeholder="Reporting cadence" />
                    <input className="settings-input" value={draftCampaign.approvalFlow || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, approvalFlow: event.target.value } : prev)} placeholder="Approval flow" />
                    <input className="settings-input" value={draftCampaign.restrictions || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, restrictions: event.target.value } : prev)} placeholder="Restrictions" />
                    <input className="settings-input" value={draftCampaign.nextAction || ''} onChange={(event) => setDraftCampaign(prev => prev ? { ...prev, nextAction: event.target.value } : prev)} placeholder="Next action" />
                    <button
                      type="button"
                      onClick={() => setDraftCampaign(prev => prev ? { ...prev, visitRequired: !prev.visitRequired } : prev)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors',
                        draftCampaign.visitRequired ? 'border-gc-orange bg-gc-orange text-white' : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      Visits {draftCampaign.visitRequired ? 'Required' : 'Optional'}
                    </button>
                  </div>
                </div>
              ) : (
                <h1 className="text-6xl font-display font-black tracking-tight text-[var(--ink-900)]">
                  {campaign.name.split(' ').slice(0, -1).join(' ')} <br />
                  <span className="text-[var(--gc-purple)]">{campaign.name.split(' ').slice(-1)} Heartbeat.</span>
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                 <div className="flex items-center gap-2 text-[var(--ink-500)]">
                    <MapPin size={18} className="text-[var(--ink-400)]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest">{campaign.city || 'Regional Markets'}</span>
                 </div>
                 <div className="flex items-center gap-2 text-[var(--ink-500)]">
                    <Calendar size={18} className="text-[var(--ink-400)]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest">{campaign.startDate ? `${campaign.startDate} - ${campaign.endDate}` : 'Timeline Undefined'}</span>
                 </div>
                 <div className="flex items-center gap-2 text-[var(--ink-500)]">
                    <Users size={18} className="text-[var(--ink-400)]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest">{campaign.targetInfluencers} Target Influencers</span>
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-2 p-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-fit">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'influencers', label: 'Influencers' },
                { id: 'media', label: 'Media' },
                { id: 'performance', label: 'Performance' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'overview' | 'influencers' | 'media' | 'performance')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors",
                    activeTab === tab.id
                      ? "bg-[var(--white)] text-[var(--ink-900)] shadow-sm"
                      : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
           </div>
        </div>
      </header>

      {(activeTab === 'overview' || activeTab === 'performance') && (
      <>
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {campaignStats.map((stat, idx) => (
           <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden p-8 bg-[var(--white)] border border-[var(--border)] rounded-3xl hover:border-[var(--gc-orange-soft)] transition-all shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground mb-1 mb-2 text-[var(--ink-500)]">{stat.label}</p>
              <div className="flex items-baseline gap-3">
                 <p className="text-4xl font-display font-black text-[var(--ink-900)] tracking-tight">{stat.value}</p>
                 <span className={cn(
                   "text-[12px] font-black tabular-nums tracking-wide",
                   stat.change.includes('+') ? "text-[var(--success)]" : "text-[var(--gc-orange)]"
                 )}>{stat.change}</span>
              </div>
              <p className="text-[11px] font-bold text-[var(--ink-400)] uppercase tracking-widest mt-4 opacity-80">{stat.sub}</p>
           </div>
         ))}
      </div>
      {activeTab === 'performance' && (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-[var(--gc-orange-soft)] bg-[var(--gc-orange-soft)]/20 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--gc-orange)]">TRYGC KPI Matrix</p>
            <h3 className="mt-1 font-condensed text-[18px] font-extrabold text-[var(--ink-900)]">Performance is linked to TRYGC KPI's performance matrix.</h3>
          </div>
          <button
            onClick={() => navigate('/performance')}
            className="rounded-xl bg-gc-orange px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-[var(--shadow-md)] hover:bg-gc-orange/90"
          >
            Open KPI Matrix
          </button>
        </div>
      )}
      </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Live Performance Feed */}
         <div className="lg:col-span-8 space-y-8">
            
            {activeTab === 'overview' && (
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
               <div className="p-8 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)]/50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[var(--gc-purple)]/10 text-[var(--gc-purple)] rounded-2xl flex items-center justify-center">
                        <CheckCircle2 size={24} />
                     </div>
                     <div>
<h3 className="font-condensed font-extrabold tracking-tight text-foreground text-[14px]">All Campaign Tasks / Routines</h3>
                         <p className="text-[11px] text-[var(--ink-500)] font-bold uppercase tracking-widest mt-1">Tasks and routines assigned to this campaign</p>
                     </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-4 py-2 text-right">
                    <p className="text-2xl font-black text-foreground">{campaignWorkItems.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Items</p>
                  </div>
               </div>
               <div className="divide-y divide-border">
                 {campaignWorkItems.length ? campaignWorkItems.map((item) => {
                   const isOpen = expandedWorkId === item.id;
                   return (
                    <div key={item.id} className="bg-card">
                      <button onClick={() => setExpandedWorkId(isOpen ? null : item.id)} className="grid w-full grid-cols-1 gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/40 md:grid-cols-[7rem_1fr_10rem_9rem_9rem_2rem] md:items-center">
                        <span className="w-fit rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gc-orange">{item.type}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-foreground">{item.title}</span>
                          <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">{item.owner}</span>
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">{item.status}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gc-orange"><Clock size={13} /> {item.sla}</span>
                        <span className="text-xs font-bold text-muted-foreground">{new Date(item.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-muted/20 px-6 py-4">
                          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-muted-foreground">{item.details}</p>
                        </div>
                      )}
                    </div>
                   );
                 }) : (
                   <div className="px-8 py-12 text-center">
                     <CheckCircle2 size={36} className="mx-auto mb-3 text-muted-foreground/40" />
                     <p className="text-sm font-bold text-muted-foreground">No task, routine, or update activity has been captured for this campaign yet.</p>
                   </div>
                 )}
               </div>
            </div>
            )}

            {/* Delivery/Visit Schedule Section */}
            {activeTab === 'influencers' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden rounded-3xl bg-[var(--white)] border border-[var(--border)] overflow-hidden shadow-sm">
               <div className="p-8 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)]/50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[var(--gc-purple)]/10 text-[var(--gc-purple)] rounded-2xl flex items-center justify-center">
                        <MapPin size={24} />
                     </div>
                     <div>
                        <h3 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground text-[14px]">Visit / Delivery Schedule</h3>
                        <p className="text-[11px] text-[var(--ink-500)] font-bold uppercase tracking-widest mt-1">Manage physical logistics and timings</p>
                     </div>
                  </div>
                  <button onClick={() => setIsEntryOpen(true)} className="px-6 py-3.5 bg-gc-orange text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gc-orange/90 transition-colors shadow-[var(--shadow-md)]">
                     Add New Entry
                  </button>
               </div>
               {isEntryOpen && (
                 <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={() => setIsEntryOpen(false)}>
                   <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
                     <div className="flex items-start justify-between border-b border-border pb-4">
                       <div>
                         <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Campaign Schedule</p>
                         <h3 className="font-condensed text-[20px] font-extrabold text-foreground">Add Visit Entry</h3>
                       </div>
                       <button className="icon-btn" onClick={() => setIsEntryOpen(false)}><X size={15} /></button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
                       <label className="space-y-1.5">
                         <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Influencer</span>
                         <input className="settings-input" value={newEntry.influencer} onChange={(event) => setNewEntry({ ...newEntry, influencer: event.target.value })} />
                       </label>
                       <label className="space-y-1.5">
                         <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Date & Time</span>
                         <input className="settings-input" value={newEntry.time} onChange={(event) => setNewEntry({ ...newEntry, time: event.target.value })} />
                       </label>
                       <label className="space-y-1.5">
                         <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Location</span>
                         <input className="settings-input" value={newEntry.location} onChange={(event) => setNewEntry({ ...newEntry, location: event.target.value })} />
                       </label>
                       <label className="space-y-1.5">
                         <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Notes</span>
                         <input className="settings-input" value={newEntry.notes} onChange={(event) => setNewEntry({ ...newEntry, notes: event.target.value })} />
                       </label>
                     </div>
                     <div className="flex justify-end gap-2 border-t border-border pt-4">
                       <button onClick={() => setIsEntryOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
                       <button onClick={addVisitEntry} className="rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">Save Entry</button>
                     </div>
                   </div>
                 </div>
               )}
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-[var(--bg)]">
                        <tr>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border pl-8">Influencer</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Date & Time</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Location / Venue</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border pr-8">Logistics Notes</th>
                           {isEditingCampaign && <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border pr-8">Delete</th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[var(--border)]">
                        {visitLogs.map((log, i) => (
                           <tr key={i} className="group hover:bg-[var(--bg)] transition-colors border-l-4 border-transparent hover:border-l-[var(--gc-purple)]">
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors pl-8 py-5">
                                 {isEditingCampaign ? (
                                   <input className="settings-input" value={log.influencer} onChange={(event) => updateVisitEntry(i, 'influencer', event.target.value)} />
                                 ) : (
                                   <p className="text-[14px] font-black text-[var(--ink-900)] group-hover:text-[var(--gc-purple)] transition-colors">{log.influencer}</p>
                                 )}
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-5">
                                 {isEditingCampaign ? (
                                   <input className="settings-input" value={log.time} onChange={(event) => updateVisitEntry(i, 'time', event.target.value)} />
                                 ) : (
                                 <div className="flex items-center gap-2 text-[var(--ink-700)]">
                                    <Calendar size={14} className="text-[var(--ink-400)]" />
                                    <span className="text-[13px] font-bold">{log.time}</span>
                                 </div>
                                 )}
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-5">
                                 {isEditingCampaign ? (
                                   <input className="settings-input" value={log.location} onChange={(event) => updateVisitEntry(i, 'location', event.target.value)} />
                                 ) : (
                                 <div className="flex items-center gap-2 text-[var(--ink-700)]">
                                    <MapPin size={14} className="text-[var(--ink-400)]" />
                                    <span className="text-[13px] font-bold">{log.location}</span>
                                 </div>
                                 )}
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-5 pr-8">
                                 {isEditingCampaign ? (
                                   <input className="settings-input" value={log.notes} onChange={(event) => updateVisitEntry(i, 'notes', event.target.value)} />
                                 ) : (
                                   <p className="text-[12px] text-[var(--ink-500)] italic truncate max-w-[200px]">{log.notes}</p>
                                 )}
                              </td>
                              {isEditingCampaign && (
                                <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-5 pr-8 text-right">
                                  <button onClick={() => removeVisitEntry(i)} className="p-2 rounded-lg text-red-600 hover:bg-red-50">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            )}

            {activeTab === 'media' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden rounded-3xl bg-[var(--white)] border border-[var(--border)] overflow-hidden shadow-sm">
               <div className="p-8 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)]/50">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[var(--gc-orange-soft)] text-[var(--gc-orange)] rounded-2xl flex items-center justify-center">
                        <Camera size={24} />
                     </div>
                     <div>
                        <h3 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground text-[14px]">Approved Influencers / Verified Content</h3>
                        <p className="text-[11px] text-[var(--ink-500)] font-bold uppercase tracking-widest mt-1">Editable approved list with coverage proof and status</p>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={contentUploadRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(event) => void bulkUploadContent(event.target.files?.[0] || null)}
                    />
                    <button onClick={() => contentUploadRef.current?.click()} className="px-5 py-3 bg-[var(--white)] border border-[var(--border-strong)] text-[var(--ink-700)] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--bg)] transition-colors shadow-sm flex items-center gap-2">
                       <Upload size={15} /> Bulk Upload
                    </button>
                    <button onClick={addContentEntry} className="px-6 py-3 bg-[var(--ink-900)] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--gc-orange)] transition-colors shadow-sm">
                       Add Row
                    </button>
                  </div>
               </div>
               {contentBulkMessage && <div className="border-b border-[var(--border)] bg-[var(--gc-orange-soft)]/20 px-8 py-3 text-[12px] font-bold text-[var(--gc-orange)]">{contentBulkMessage}</div>}
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-[var(--bg)]">
                        <tr>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border pl-8">Influencer Asset</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Tactical Status</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border">Coverage Sync</th>
                           <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground bg-muted/30 border-b border-border pr-8"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[var(--border)]">
                        {contentFeed.map((item) => (
                           <tr key={item.id} className="group hover:bg-[var(--bg)] transition-colors border-l-4 border-transparent hover:border-l-[var(--gc-orange)]">
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors pl-8 py-6">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[var(--white)] border border-[var(--border-strong)] rounded-xl flex items-center justify-center text-[var(--ink-400)] relative shadow-sm group-hover:text-[var(--gc-orange)] transition-colors">
                                       <PlayCircle size={22} />
                                       {item.platform === 'TikTok' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--ink-900)] rounded-full border border-white" />}
                                    </div>
                                    <div>
                                       <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                         <input className="settings-input min-w-28" value={item.influencer} onChange={(event) => updateContentEntry(item.id, 'influencer', event.target.value)} placeholder="Influencer" />
                                         <input className="settings-input min-w-28" value={item.platform} onChange={(event) => updateContentEntry(item.id, 'platform', event.target.value)} placeholder="Platform" />
                                         <input className="settings-input min-w-28" value={item.type} onChange={(event) => updateContentEntry(item.id, 'type', event.target.value)} placeholder="Type" />
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-6">
                                 <select className="settings-input min-w-32" value={item.status} onChange={(event) => updateContentEntry(item.id, 'status', event.target.value)}>
                                   {['Pending', 'Reviewing', 'Approved', 'Rejected'].map(status => <option key={status}>{status}</option>)}
                                 </select>
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-6">
                                 <div className="space-y-1">
                                    <div className="grid grid-cols-1 gap-2">
                                      <input className="settings-input min-w-28" value={item.coverage} onChange={(event) => updateContentEntry(item.id, 'coverage', event.target.value)} placeholder="Coverage" />
                                      <input className="settings-input min-w-28" value={item.velocity} onChange={(event) => updateContentEntry(item.id, 'velocity', event.target.value)} placeholder="Velocity" />
                                    </div>
                                 </div>
                              </td>
                              <td className="px-5 py-3.5 border-b border-border bg-card group-hover:bg-accent/40 transition-colors py-6 pr-8 text-right">
                                 <button onClick={() => removeContentEntry(item.id)} className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors" title="Delete media row">
                                    <Trash2 size={18} />
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <div className="p-6 bg-[var(--bg)] text-center border-t border-[var(--border)]">
                  <button className="text-[11px] font-black uppercase tracking-widest text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors">View All Archive Operations</button>
               </div>
            </div>
            )}

         </div>

         {/* Sidebar: Operational Roadmap */}
         <div className="lg:col-span-4 space-y-8">
            {(activeTab === 'overview' || activeTab === 'performance') && (
            <div className="bg-card border border-border rounded-xl overflow-hidden p-10 bg-[var(--white)] border border-[var(--border)] rounded-3xl shadow-sm">
               <div className="flex items-center justify-between mb-10">
                  <h3 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground text-[13px] tracking-widest">Mission Roadmap</h3>
                  <div className="px-3.5 py-1.5 bg-[var(--success)]/10 text-[var(--success)] rounded-lg text-[10px] font-black uppercase tracking-widest">
                     In-Progress
                  </div>
               </div>

               <div className="relative space-y-10">
                  <div className="absolute left-[13px] top-4 bottom-4 w-[2px] bg-[var(--border-strong)]" />
                  {MILESTONES.map((step, idx) => (
                    <div key={idx} className="relative pl-12 group">
                       <div className={cn(
                         "absolute left-0 top-1 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border",
                         step.status === 'completed' ? "bg-[var(--success)] text-white shadow-[var(--success)]/20 border-transparent scale-110" :
                         step.status === 'active' ? "bg-[var(--gc-orange)] text-white shadow-[var(--gc-orange-soft)] animate-pulse scale-[1.2] border-transparent" :
                         "bg-[var(--bg)] text-[var(--ink-400)] border-[var(--border-strong)]"
                       )}>
                          {step.status === 'completed' ? <CheckCircle2 size={16} strokeWidth={3} /> : 
                           step.status === 'active' ? <Clock size={16} strokeWidth={3} /> : 
                           <div className="w-2 h-2 rounded-full bg-[var(--ink-300)]" />}
                       </div>
                       <div className="space-y-1">
                          <p className={cn(
                            "text-[13px] font-black uppercase tracking-widest transition-colors",
                            step.status === 'active' ? "text-[var(--ink-900)]" : "text-[var(--ink-500)]"
                          )}>{step.stage}</p>
                          <p className="text-[11px] font-bold text-[var(--ink-400)] tabular-nums uppercase tracking-wide mt-1">{step.date} • <span className={step.status==='active' ? 'text-[var(--gc-orange)]' : ''}>{step.status}</span></p>
                          {step.progress && (
                            <div className="pt-4 space-y-2">
                               <div className="h-1.5 bg-[var(--bg)] border border-[var(--border-strong)] rounded-full overflow-hidden shadow-inner">
                                  <div className="h-full bg-[var(--gc-orange)]" style={{ width: `${step.progress}%` }} />
                               </div>
                               <p className="text-[10px] font-black text-[var(--gc-orange)] uppercase tracking-widest text-right">{step.progress}% Capacity filled</p>
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
               </div>

               <button
                 onClick={() => setIsAuditOpen((current) => !current)}
                 className="w-full mt-12 py-4 border border-[var(--border-strong)] text-[var(--ink-900)] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[var(--ink-900)] hover:text-white hover:border-[var(--ink-900)] transition-all shadow-sm"
               >
                  {isAuditOpen ? 'Hide TRYGC Audit' : 'Run TRYGC Campaign Audit'}
               </button>
               {isAuditOpen && (
                 <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
                   <div className="flex items-start justify-between gap-4">
                     <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-[var(--gc-orange)]">Audit score</p>
                       <h4 className="mt-1 text-3xl font-black text-[var(--ink-900)]">{audit.score}%</h4>
                     </div>
                     <span className={cn(
                       'rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide',
                       audit.tone === 'green' ? 'border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]' :
                       audit.tone === 'red' ? 'border-[var(--danger)]/20 bg-[var(--danger)]/10 text-[var(--danger)]' :
                       'border-[var(--gc-orange)]/20 bg-[var(--gc-orange-soft)] text-[var(--gc-orange)]'
                     )}>
                       {audit.label}
                     </span>
                   </div>
                   <p className="mt-3 text-[12px] font-bold leading-relaxed text-[var(--ink-500)]">{audit.summary}</p>
                   <div className="mt-5 space-y-3">
                     {audit.findings.map((finding) => (
                       <div key={finding.title} className="rounded-xl border border-[var(--border)] bg-[var(--white)] p-4">
                         <div className="flex items-center justify-between gap-3">
                           <p className="text-[12px] font-black uppercase tracking-wide text-[var(--ink-900)]">{finding.title}</p>
                           <span className={cn(
                             'rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide',
                             finding.tone === 'green' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                             finding.tone === 'red' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' :
                             'bg-[var(--gc-orange-soft)] text-[var(--gc-orange)]'
                           )}>
                             {finding.owner}
                           </span>
                         </div>
                         <p className="mt-2 text-[12px] font-semibold leading-relaxed text-[var(--ink-500)]">{finding.detail}</p>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden p-6 bg-[var(--white)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-condensed font-extrabold text-[13px] tracking-widest uppercase text-foreground">Owner Assignment</h4>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaign Control</span>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Owner</span>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-bold text-foreground outline-none focus:border-gc-orange"
                    value={ownerDraft}
                    onChange={(event) => setOwnerDraft(event.target.value)}
                  >
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={saveOwnerAssignment}
                  className="w-full rounded-lg bg-gc-orange px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-gc-orange/90"
                >
                  Save Owner
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Current: <span className="font-bold text-foreground">{campaign.currentOwner || 'Unassigned'}</span>
                </p>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function buildTrygcAudit(
  campaign: Campaign,
  metrics: { confirmations: number; coverage: number; visited: number; missed: number; approved: number; reject: number },
) {
  const target = Math.max(campaign.targetInfluencers || 0, 1);
  const coverageTarget = Math.max(campaign.targetPostingCoverage || campaign.targetInfluencers || 0, 1);
  const confirmationRate = Math.round((metrics.confirmations / target) * 100);
  const visitRate = Math.round((metrics.visited / target) * 100);
  const coverageRate = Math.round((metrics.coverage / coverageTarget) * 100);
  const rejectRate = Math.round((metrics.reject / Math.max(metrics.approved + metrics.reject, 1)) * 100);
  const daysLeft = campaign.endDate ? Math.ceil((new Date(`${campaign.endDate}T23:59:59`).getTime() - Date.now()) / 86400000) : 0;
  const schedulePressure = daysLeft <= 7 && coverageRate < 80;
  const score = Math.max(0, Math.min(100, Math.round(
    (Math.min(confirmationRate, 100) * 0.28) +
    (Math.min(visitRate, 100) * 0.24) +
    (Math.min(coverageRate, 100) * 0.34) +
    ((100 - Math.min(rejectRate, 100)) * 0.14),
  )));
  const findings: AuditFinding[] = [];

  if (confirmationRate < 70) {
    findings.push({
      title: 'Push confirmations',
      detail: `Confirmations are at ${confirmationRate}%. Community should prioritize fresh outreach, reminders, and replacement profiles until the campaign reaches at least 80%.`,
      owner: 'Community',
      tone: 'red',
    });
  } else {
    findings.push({
      title: 'Confirmation base is usable',
      detail: `Confirmations are at ${confirmationRate}%. Keep reminders active, but the campaign can stay focused on scheduling and execution.`,
      owner: 'Community',
      tone: 'green',
    });
  }

  if (visitRate < 60 && campaign.visitRequired) {
    findings.push({
      title: 'Tighten visit schedule',
      detail: `Visited is at ${visitRate}% with ${metrics.missed} still open. Coordination should lock today's and tomorrow's visit slots and flag any influencer without a clear time.`,
      owner: 'Coordination',
      tone: 'red',
    });
  } else if (campaign.visitRequired) {
    findings.push({
      title: 'Visit execution is moving',
      detail: `Visited is at ${visitRate}%. Keep missed visits visible in handover until all late slots have an owner.`,
      owner: 'Coordination',
      tone: 'orange',
    });
  }

  if (coverageRate < 80) {
    findings.push({
      title: 'Recover coverage',
      detail: `Coverage is at ${coverageRate}%. Coverage team should chase missing posts, confirm links, and separate posted-but-not-approved content from truly missing coverage.`,
      owner: 'Coverage',
      tone: schedulePressure ? 'red' : 'orange',
    });
  } else {
    findings.push({
      title: 'Coverage is close to target',
      detail: `Coverage is at ${coverageRate}%. QA can now focus on proof quality, tag compliance, mentions, and archive links.`,
      owner: 'QA',
      tone: 'green',
    });
  }

  if (rejectRate > 10) {
    findings.push({
      title: 'Review rejected content',
      detail: `Reject rate is ${rejectRate}%. QA should group rejection reasons and send one clear correction note to owners before more coverage is submitted.`,
      owner: 'QA',
      tone: 'red',
    });
  }

  if (schedulePressure) {
    findings.push({
      title: 'End-date pressure',
      detail: `${daysLeft <= 0 ? 'The end date has arrived or passed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}. Escalate blockers today and move unresolved gaps into recovery mode.`,
      owner: 'PMO',
      tone: 'red',
    });
  }

  if (!findings.some((item) => item.owner === 'PMO')) {
    findings.push({
      title: 'PMO next step',
      detail: `Keep one owner on the next action: ${campaign.nextAction || 'set the next measurable campaign action'}. Update this after the next handover.`,
      owner: 'PMO',
      tone: score >= 75 ? 'green' : 'orange',
    });
  }

  const tone: AuditFinding['tone'] = score >= 75 ? 'green' : score >= 50 ? 'orange' : 'red';
  const label = tone === 'green' ? 'On track' : tone === 'orange' ? 'Needs control' : 'At risk';
  const summary = `TRYGC audit checks confirmations, visit execution, coverage, QA rejects, and end-date pressure. Current read: confirmations ${confirmationRate}%, visits ${visitRate}%, coverage ${coverageRate}%.`;

  return { score, tone, label, summary, findings };
}
