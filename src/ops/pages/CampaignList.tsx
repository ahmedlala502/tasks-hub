/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Cloud, Download, Edit3, FileSpreadsheet, FolderKanban, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { CampaignStage, STAGE_NAMES } from '../constants';
import type { Campaign, Task } from '../types';
import { cn } from '../utils';
import { buildAssignmentOptions } from '../lib/assignmentOptions';
import { buildMyCampaignMatrix, getOperationalTaskStatus } from '../lib/opsPageInsights';
import { dataService, TEAM_MEMBERS } from '../services/dataService';
import { notify } from '../services/notificationService';
import { opsCampaignsService } from '../services/opsCampaignsService';
import { exportCampaigns, rowsToCampaigns } from '../services/spreadsheetService';
import { BulkUploadButton } from '../components/BulkUploadDialog';

type CampaignTaskDraft = {
  id?: string;
  campaignId: string;
  title: string;
  ownerId: string;
  department: string;
  priority: Task['priority'];
  status: NonNullable<Task['status']>;
  dueDate: string;
  nextStep: string;
  metricTarget: string;
  metricCON: string;
  metricCOV: string;
};

const EMPTY_TASK: CampaignTaskDraft = {
  campaignId: '',
  title: '',
  ownerId: '',
  department: 'PMO',
  priority: 'Medium',
  status: 'In Progress',
  dueDate: new Date().toISOString().slice(0, 10),
  nextStep: '',
  metricTarget: '',
  metricCON: '',
  metricCOV: '',
};

const TEAM_BUCKETS = ['PMO', 'Community', 'Coverage', 'QA', 'Reporting', 'Finance', 'Operations'];

const TRACKER_COLUMNS: Array<{ label: string; value: (campaign: Campaign) => React.ReactNode; align?: 'right' }> = [
  { label: 'Campaign Name', value: (campaign) => campaign.name },
  { label: 'Country', value: (campaign) => campaign.country },
  { label: 'Type', value: (campaign) => campaign.type },
  { label: 'Total List', value: (campaign) => formatMetric(campaign.totalList), align: 'right' },
  { label: 'Confirmations', value: (campaign) => formatMetric(campaign.confirmations), align: 'right' },
  { label: 'Target', value: (campaign) => formatMetric(campaign.targetInfluencers), align: 'right' },
  { label: 'Visited', value: (campaign) => formatMetric(campaign.visited), align: 'right' },
  { label: 'Coverage', value: (campaign) => formatMetric(campaign.coverage), align: 'right' },
  { label: 'Approved', value: (campaign) => formatMetric(campaign.approved), align: 'right' },
  { label: 'Reject', value: (campaign) => formatMetric(campaign.reject), align: 'right' },
  { label: 'Daily Target', value: (campaign) => formatMetric(campaign.dailyTarget), align: 'right' },
  { label: "Today's Visits", value: (campaign) => formatMetric(campaign.todaysVisits), align: 'right' },
  { label: "Tomorrow's Visits", value: (campaign) => formatMetric(campaign.tomorrowsVisits), align: 'right' },
  { label: 'Day After', value: (campaign) => formatMetric(campaign.dayAfterVisits), align: 'right' },
  { label: 'Start Date', value: (campaign) => campaign.startDate || '-' },
  { label: 'End Date', value: (campaign) => campaign.endDate || '-' },
  { label: 'Run Rate', value: (campaign) => formatMetric(campaign.runRate), align: 'right' },
  { label: '% of Target', value: (campaign) => formatRate(campaign.targetRate), align: 'right' },
  { label: 'Conf Rate %', value: (campaign) => formatRate(campaign.confirmationRate), align: 'right' },
  { label: 'Cov Rate %', value: (campaign) => formatRate(campaign.coverageRate), align: 'right' },
];

export default function CampaignList() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isMaster = role === 'master';
  const [campaigns, setCampaigns] = useState<Campaign[]>(dataService.getCampaigns());
  const [tasks, setTasks] = useState<Task[]>(dataService.getTasks());
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<number | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [taskDraft, setTaskDraft] = useState<CampaignTaskDraft | null>(null);
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<'loading' | 'ready' | 'offline'>('loading');

  const assignmentOptions = useMemo(() => buildAssignmentOptions({
    users: TEAM_MEMBERS,
    tasks,
    campaigns,
    handovers: dataService.getHandovers(),
  }), [campaigns, tasks]);

  const filteredCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const haystack = `${campaign.name} ${campaign.currentOwner} ${campaign.country} ${campaign.city} ${campaign.nextAction}`.toLowerCase();
    return (stage === 'all' || campaign.stage === stage) && (!query || haystack.includes(query.toLowerCase()));
  }), [campaigns, query, stage]);

  const matrix = useMemo(() => buildMyCampaignMatrix(filteredCampaigns, tasks), [filteredCampaigns, tasks]);
  const openTasks = tasks.filter((task) => getOperationalTaskStatus(task) !== 'Done').length;
  const blockedTasks = tasks.filter((task) => getOperationalTaskStatus(task) === 'Blocked').length;

  useEffect(() => {
    let alive = true;
    opsCampaignsService
      .list()
      .then((onlineCampaigns) => {
        if (!alive) return;
        if (onlineCampaigns.length) {
          const localCampaigns = dataService.getCampaigns();
          if (!localCampaigns.length) {
            dataService.upsertCampaigns(onlineCampaigns);
            setCampaigns(onlineCampaigns);
          } else {
            setCampaigns(localCampaigns);
          }
        }
        setOnlineStatus('ready');
      })
      .catch((error) => {
        console.error('Online campaigns failed to load', error);
        if (alive) setOnlineStatus('offline');
      });

    return () => {
      alive = false;
    };
  }, []);

  const toggleExpanded = (campaignId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const openTask = (campaign: Campaign, task?: Task, department = 'PMO') => {
    if (task) {
      setTaskDraft({
        id: task.id,
        campaignId: campaign.name,
        title: task.title,
        ownerId: task.ownerId || campaign.currentOwner || assignmentOptions[0] || '',
        department: task.department || task.category || department,
        priority: task.priority,
        status: getOperationalTaskStatus(task),
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        nextStep: task.nextStep || task.description || '',
        metricTarget: String(task.metricTarget || ''),
        metricCON: String(task.metricCON || ''),
        metricCOV: String(task.metricCOV || ''),
      });
      return;
    }

    setTaskDraft({
      ...EMPTY_TASK,
      campaignId: campaign.name,
      ownerId: campaign.currentOwner || assignmentOptions[0] || '',
      department,
      metricTarget: String(campaign.targetInfluencers || ''),
    });
  };

  const saveTask = () => {
    if (!taskDraft?.title.trim()) return;
    const now = Date.now();
    const existing = taskDraft.id ? tasks.find((task) => task.id === taskDraft.id) : undefined;
    const dueDate = new Date(`${taskDraft.dueDate}T18:00:00`).getTime();
    const task: Task = {
      id: taskDraft.id || `campaign-task-${now}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      createdBy: 'campaigns',
      title: taskDraft.title.trim(),
      description: taskDraft.nextStep.trim(),
      nextStep: taskDraft.nextStep.trim(),
      ownerId: taskDraft.ownerId,
      campaignId: taskDraft.campaignId,
      department: taskDraft.department,
      category: taskDraft.department,
      priority: taskDraft.priority,
      status: taskDraft.status,
      dueDate,
      completed: taskDraft.status === 'Done',
      completedAt: taskDraft.status === 'Done' ? now : undefined,
      metricTarget: Number(taskDraft.metricTarget) || 0,
      metricCON: Number(taskDraft.metricCON) || 0,
      metricCOV: Number(taskDraft.metricCOV) || 0,
      flags: taskDraft.status === 'Blocked' ? [{ id: `campaign-flag-${now}`, label: 'Blocked', tone: 'red', resolved: false }] : [],
    };
    setTasks(taskDraft.id ? dataService.updateTask(taskDraft.id, task) : dataService.addTask(task));
    setTaskDraft(null);
    notify('Campaign Task Saved', `"${task.title}" saved in ${task.campaignId}`, 'orange', '/campaigns');
  };

  const updateTaskStatus = (task: Task, status: NonNullable<Task['status']>) => {
    setTasks(dataService.updateTask(task.id, {
      status,
      completed: status === 'Done',
      completedAt: status === 'Done' ? Date.now() : undefined,
      updatedAt: Date.now(),
    }));
  };

  const deleteTask = (task: Task) => {
    if (!isMaster) return;
    setTasks(dataService.deleteTask(task.id));
    notify('Campaign Task Deleted', `"${task.title}" removed`, 'red', '/campaigns');
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (!isMaster) return;
    const localCampaigns = dataService.deleteCampaign(campaign.id);
    setCampaigns(localCampaigns);
    setConfirmDeleteCampaign(null);
    try {
      const onlineCampaigns = await opsCampaignsService.remove(campaign.id);
      setCampaigns(onlineCampaigns);
      dataService.upsertCampaigns(onlineCampaigns);
      notify('Campaign Deleted', `"${campaign.name}" removed online`, 'red', '/campaigns');
    } catch (error) {
      console.error(error);
      notify('Campaign Deleted Locally', `"${campaign.name}" was removed here, but online sync failed`, 'red', '/campaigns');
    }
  };

  const commitCampaigns = async (items: Campaign[]) => {
    const { campaigns: next, inserted, updated } = await opsCampaignsService.upsert(items);
    dataService.upsertCampaigns(next);
    setCampaigns(next);
    setOnlineStatus('ready');
    setBulkMessage(`${inserted} added, ${updated} updated.`);
    notify('Campaigns Imported Online', `${inserted} added, ${updated} updated.`, 'green', '/campaigns');
    return { inserted, updated };
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Campaigns</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Campaign Execution Buckets</h2>
            <p className="mt-1 text-sm text-muted-foreground">Expandable campaign buckets with PMO-style task lanes, assignment, status, edits, and master-only delete.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-wide',
              onlineStatus === 'ready'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                : onlineStatus === 'offline'
                  ? 'border-red-500/20 bg-red-500/10 text-red-700'
                  : 'border-border bg-muted text-muted-foreground',
            )}>
              <Cloud size={14} /> {onlineStatus === 'ready' ? 'Online sync' : onlineStatus === 'offline' ? 'Sync issue' : 'Syncing'}
            </span>
            <button onClick={() => navigate('/campaigns/new')} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-gc-orange/90">
              <Plus size={16} /> New campaign
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="Campaigns" value={filteredCampaigns.length} />
        <Metric title="Open Tasks" value={openTasks} tone="purple" />
        <Metric title="Blocked Tasks" value={blockedTasks} tone="red" />
        <Metric title="Master Delete" value={isMaster ? 'On' : 'Locked'} tone={isMaster ? 'green' : 'orange'} />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gc-orange/20 bg-gc-orange/5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gc-orange text-white">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">Bulk upload campaigns online</p>
              <p className="mt-1 text-xs text-muted-foreground">Upload CSV or Excel, preview every row, fix rejected rows, then publish to Supabase for the whole team.</p>
            </div>
          </div>
            <BulkUploadButton<Campaign>
              label="Bulk upload"
              title="Bulk Import Campaigns"
            templateHeaders={TRACKER_COLUMNS.map((column) => column.label)}
            parse={rowsToCampaigns}
            validate={c => {
              const errs: string[] = [];
              if (!c.name) errs.push('Missing name');
              if (!c.country) errs.push('Missing country');
              if (!c.startDate) errs.push('Missing start date');
              if (!c.endDate) errs.push('Missing end date');
              return errs;
            }}
            commit={commitCampaigns}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_15rem_auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="settings-input pl-9" placeholder="Search campaign, owner, market, next action..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="settings-input" value={stage} onChange={(event) => setStage(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
            <option value="all">All lifecycle stages</option>
            {Object.entries(STAGE_NAMES).map(([key, label]) => <option key={key} value={key}>{key}. {label}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => exportCampaigns(filteredCampaigns)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        {bulkMessage && <p className="mt-3 text-xs font-semibold text-gc-orange">{bulkMessage}</p>}
      </section>

      <section className="space-y-4">
        {matrix.length ? matrix.map((item) => {
          const isOpen = expanded.has(item.campaign.id);
          const laneNames = [...new Set([...TEAM_BUCKETS, ...item.teamLanes.map((lane) => lane.name)])];
          return (
            <div key={item.campaign.id} className="rounded-xl border border-border bg-card shadow-sm">
              <button onClick={() => toggleExpanded(item.campaign.id)} className="flex w-full flex-col gap-4 p-5 text-left lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gc-orange/10 text-gc-orange">
                    <FolderKanban size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black text-foreground">{item.campaign.name}</h3>
                      <StatusPill value={item.campaign.status} />
                      <HealthPill value={item.campaign.recordHealth} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.campaign.country || 'No market'} - Owner: {item.campaign.currentOwner || 'Unassigned'} - {item.campaign.nextAction || 'No next action set'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 lg:w-[500px]">
                  <MiniStat label="Tasks" value={`${item.doneCount}/${item.taskCount}`} sub={`${item.openCount} open`} />
                  <MiniStat label="Confirmations" value={`${item.confirmationTotal}/${item.targetTotal}`} sub={`${item.confirmationProgress}%`} />
                  <MiniStat label="Coverage" value={`${item.coverageTotal}/${item.campaign.targetPostingCoverage || item.targetTotal}`} sub={`${item.coverageProgress}%`} />
                  <div className="flex items-center justify-end">
                    <ChevronDown className={cn('text-muted-foreground transition-transform', isOpen && 'rotate-180')} size={18} />
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Campaign tasks</p>
                      <p className="mt-1 text-xs text-muted-foreground">Add work to the right lane, assign it, and update status without leaving the campaign bucket.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <BadgeStat label="Tasks" value={`${item.taskCount}`} />
                      <BadgeStat label="Confirmations" value={`${item.confirmationTotal}/${item.targetTotal}`} />
                      <BadgeStat label="Coverage" value={`${item.coverageTotal}/${item.campaign.targetPostingCoverage || item.targetTotal}`} />
                      <BadgeStat label="Blocked" value={`${item.blockedCount}`} tone={item.blockedCount ? 'red' : 'green'} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/campaigns/${item.campaign.id}`)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">Details</button>
                      {isMaster && (
                        confirmDeleteCampaign === item.campaign.id ? (
                          <>
                            <button onClick={() => deleteCampaign(item.campaign)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Delete campaign</button>
                            <button onClick={() => setConfirmDeleteCampaign(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteCampaign(item.campaign.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Delete</button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-3">
                    {laneNames.map((laneName) => {
                      const lane = item.teamLanes.find((entry) => entry.name === laneName);
                      const laneTasks = lane?.tasks || [];
                      return (
                        <div key={laneName} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{laneName}</p>
                            <button onClick={() => openTask(item.campaign, undefined, laneName)} className="icon-btn" title="Add task"><Plus size={14} /></button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {laneTasks.length ? laneTasks.map((task) => (
                              <div key={task.id} className="rounded-lg border border-border bg-card p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{task.title}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{task.ownerId || 'Unassigned'} - {task.priority}</p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button onClick={() => openTask(item.campaign, task, laneName)} className="icon-btn" title="Edit task"><Edit3 size={13} /></button>
                                    {isMaster && <button onClick={() => deleteTask(task)} className="icon-btn text-red-500" title="Delete task"><Trash2 size={13} /></button>}
                                  </div>
                                </div>
                                <select className="settings-input mt-2 h-8 text-[11px]" value={getOperationalTaskStatus(task)} onChange={(event) => updateTaskStatus(task, event.target.value as NonNullable<Task['status']>)}>
                                  {['Pending', 'In Progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                              </div>
                            )) : <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No tasks in this lane</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No campaigns match your filters.</div>
        )}
      </section>

      {taskDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-foreground">{taskDraft.id ? 'Edit campaign task' : 'Add campaign task'}</h3>
              <button onClick={() => setTaskDraft(null)} className="icon-btn"><X size={16} /></button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input className="settings-input md:col-span-2" placeholder="Task title" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
              <input className="settings-input" value={taskDraft.campaignId} onChange={(event) => setTaskDraft({ ...taskDraft, campaignId: event.target.value })} />
              <select className="settings-input" value={taskDraft.ownerId} onChange={(event) => setTaskDraft({ ...taskDraft, ownerId: event.target.value })}>
                <option value="">Assigned to...</option>
                {[taskDraft.ownerId, ...assignmentOptions].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              </select>
              <select className="settings-input" value={taskDraft.department} onChange={(event) => setTaskDraft({ ...taskDraft, department: event.target.value })}>
                {[taskDraft.department, ...TEAM_BUCKETS].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>)}
              </select>
              <input className="settings-input" type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} />
              <select className="settings-input" value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Task['priority'] })}>
                {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              <select className="settings-input" value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as NonNullable<Task['status']> })}>
                {['Pending', 'In Progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input className="settings-input" placeholder="Target" value={taskDraft.metricTarget} onChange={(event) => setTaskDraft({ ...taskDraft, metricTarget: event.target.value })} />
              <input className="settings-input" placeholder="CON" value={taskDraft.metricCON} onChange={(event) => setTaskDraft({ ...taskDraft, metricCON: event.target.value })} />
              <input className="settings-input" placeholder="COV" value={taskDraft.metricCOV} onChange={(event) => setTaskDraft({ ...taskDraft, metricCOV: event.target.value })} />
              <textarea className="settings-input min-h-20 resize-none md:col-span-2" placeholder="Next step / result" value={taskDraft.nextStep} onChange={(event) => setTaskDraft({ ...taskDraft, nextStep: event.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setTaskDraft(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">Cancel</button>
              <button onClick={saveTask} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-xs font-bold text-white hover:bg-gc-orange/90"><Save size={15} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMetric(value: number | string | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value);
}

function formatRate(value: number | string | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function Metric({ title, value, tone = 'orange' }: { title: string; value: number | string; tone?: 'orange' | 'green' | 'red' | 'purple' }) {
  const toneClass = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'purple' ? 'text-gc-purple' : 'text-gc-orange';
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-muted-foreground">{title}</p>
      <p className={cn('mt-3 text-3xl font-black', toneClass)}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-right">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-black text-foreground">{value}</p>
      {sub && <p className="text-[10px] font-black uppercase tracking-wide text-gc-orange">{sub}</p>}
    </div>
  );
}

function BadgeStat({ label, value, tone = 'orange' }: { label: string; value: string; tone?: 'orange' | 'green' | 'red' }) {
  const styles = tone === 'green'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
    : tone === 'red'
      ? 'border-red-500/20 bg-red-500/10 text-red-700'
      : 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange';
  return (
    <span className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide', styles)}>
      {label}: {value}
    </span>
  );
}

function StatusPill({ value }: { value: Campaign['status'] }) {
  const styles = value === 'Active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : value === 'Blocked' ? 'border-red-500/20 bg-red-500/10 text-red-600' : 'border-border bg-muted text-muted-foreground';
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', styles)}>{value}</span>;
}

function HealthPill({ value }: { value: Campaign['recordHealth'] }) {
  const styles = value === 'Healthy' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : value === 'At Risk' ? 'border-gc-orange/20 bg-gc-orange/10 text-gc-orange' : 'border-red-500/20 bg-red-500/10 text-red-600';
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', styles)}>{value}</span>;
}
