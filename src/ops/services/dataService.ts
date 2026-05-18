/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format } from 'date-fns';
import { CampaignStage } from '../constants';
import { Campaign, CampaignInfluencer, Blocker, Handover, Task } from '../types';
import { ensureDailyOperatingTasks } from '../lib/dailyOperatingTasks';
import completedTasksCsv from '../data/community-done-tasks.csv?raw';
import attachedWorkspaceExport from '../data/attached-workspace-export.json';
import { CAMPAIGNS_20260515 } from '../data/campaigns-20260515';
import { buildImportedCompletedTasks, deriveUsersFromCompletedTasks, extractUsersFromWorkspaceExport, parseCompletedTasksCsv } from '../lib/importedWorkspaceData';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';
import { getNewHandoverRecipients, getTaskAssignmentRecipient } from '../lib/personalWork';
import { cloudWorkspaceService, type ActivityDraft, type UserActivityLog, type WorkspaceRecordType } from './cloudWorkspaceService';
import { notify } from './notificationService';

const buildCampaignId = (seed: number) => `C-${Date.now()}-${seed}-${Math.random().toString(36).slice(2, 7)}`;

const normalizeCampaignIds = (campaigns: Campaign[]) => {
  const usedIds = new Set<string>();
  let hasChanges = false;

  const normalized = campaigns.map((campaign, index) => {
    const existingId = String((campaign as any).id ?? '').trim();
    let finalId = existingId;

    if (!finalId || usedIds.has(finalId)) {
      hasChanges = true;
      do {
        finalId = buildCampaignId(index + 1);
      } while (usedIds.has(finalId));
    }

    usedIds.add(finalId);
    return finalId === campaign.id ? campaign : { ...campaign, id: finalId };
  });

  return { normalized, hasChanges };
};

export const TEAM_MEMBERS: string[] = [
  'Ahmed E.', 'Sarah A.', 'Mona K.', 'Omar S.', 'Nurhan M.', 'Khalid J.',
  'Campaign Manager', 'Community Lead', 'Coordination Lead', 'Coverage Lead',
  'QA Lead', 'Finance Lead', 'Head of Operations',
  ...DEFAULT_ACCESS_USERS.map((user) => user.name),
];

export const ATTACHED_EXPORT_USERS = extractUsersFromWorkspaceExport(attachedWorkspaceExport);
const IMPORTED_COMPLETED_TASK_ROWS = parseCompletedTasksCsv(completedTasksCsv);
export const IMPORTED_COMPLETED_TASKS = buildImportedCompletedTasks(IMPORTED_COMPLETED_TASK_ROWS);

const INITIAL_CAMPAIGNS_DATA: Campaign[] = CAMPAIGNS_20260515;

export const INITIAL_INFLUENCERS_DATA: CampaignInfluencer[] = [
  {
    id: 'CI-001', campaignId: 'C-RED-001', influencerId: 'INF-101', username: '@lifestyle_sa',
    platform: 'Instagram', status: 'Confirmed', niche: 'Lifestyle', followerRange: '100k-500k',
    invitationWave: 1, reminder1Sent: true, reminder2Sent: false, visitCompleted: true,
    coverageReceived: true, qaStatus: 'Approved', ownerId: 'Sarah A.',
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system',
  },
];

export const INITIAL_BLOCKERS_DATA: Blocker[] = [
  {
    id: 'B-001', campaignId: 'C-RED-001', summary: 'Visit Proof Mismatch',
    impact: 'QA blocking', status: 'Open', severity: 'Critical',
    ownerId: 'Sarah A.', createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system',
  },
];

const INITIAL_TASKS_DATA: Task[] = [];

const INITIAL_HANDOVERS_DATA: Handover[] = TEAM_MEMBERS.map((user, idx) => ({
  id: `HO-DEMO-${idx}`,
  handoffDate: format(new Date(), 'yyyy-MM-dd'),
  fromShift: 'Morning',
  toShift: 'Mid',
  team: 'Operations',
  region: 'Regional',
  outgoingLead: user,
  incomingLead: TEAM_MEMBERS[(idx + 1) % TEAM_MEMBERS.length],
  assignFrom: [user],
  assignTo: [TEAM_MEMBERS[(idx + 1) % TEAM_MEMBERS.length]],
  notes: `Shift relay context for ${user}.`,
  taskIds: [`TSK-DEMO-${idx}`],
  status: 'Pending',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'system',
}));

const DEMO_HANDOVER_IDS = new Set([
  'HO-1778620084142',
  'HO-1778620079406',
  'HO-1778620077935',
  'HO-001',
  'HO-002',
]);

const loadFromStorage = (key: string, initialData: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialData;
  } catch (e) {
    return initialData;
  }
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
};

// Clear any stale demo data from old storage keys (including V2, V3 bulk tasks)
(['GC_CAMPAIGNS', 'GC_INFLUENCERS', 'GC_BLOCKERS', 'GC_TASKS', 'GC_HANDOVERS',
  'GC_CAMPAIGNS_V2', 'GC_INFLUENCERS_V2', 'GC_BLOCKERS_V2', 'GC_TASKS_V2', 'GC_HANDOVERS_V2',
  'GC_TASKS_V3',
] as const).forEach(key => {
  localStorage.removeItem(key);
});

// V6 — campaigns replaced from campaigns_20260515_1730.xlsx
const STORAGE_KEYS = {
  campaigns: 'GC_CAMPAIGNS_V6',
  influencers: 'GC_INFLUENCERS_V4',
  blockers: 'GC_BLOCKERS_V4',
  tasks: 'GC_TASKS_V5',
  handovers: 'GC_HANDOVERS_V4',
};

export let CAMPAIGNS_DATA: Campaign[] = loadFromStorage(STORAGE_KEYS.campaigns, INITIAL_CAMPAIGNS_DATA);
export let INFLUENCERS_DATA: CampaignInfluencer[] = loadFromStorage(STORAGE_KEYS.influencers, INITIAL_INFLUENCERS_DATA);
export let BLOCKERS_DATA: Blocker[] = loadFromStorage(STORAGE_KEYS.blockers, INITIAL_BLOCKERS_DATA);
export let TASKS_DATA: Task[] = loadFromStorage(STORAGE_KEYS.tasks, INITIAL_TASKS_DATA);
export let HANDOVERS_DATA: Handover[] = loadFromStorage(STORAGE_KEYS.handovers, INITIAL_HANDOVERS_DATA);
let ACTIVITY_LOGS: UserActivityLog[] = [];
let cloudInitialized = false;
let cloudAvailable = true;

const realHandovers = HANDOVERS_DATA.filter((handover) => !DEMO_HANDOVER_IDS.has(handover.id) && handover.createdBy !== 'system');
if (realHandovers.length !== HANDOVERS_DATA.length) {
  HANDOVERS_DATA = realHandovers;
  saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
}

const hydratedCampaigns = normalizeCampaignIds(CAMPAIGNS_DATA);
CAMPAIGNS_DATA = hydratedCampaigns.normalized;
if (hydratedCampaigns.hasChanges) {
  saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
}

const mergeImportedCompletedTasks = () => {
  const existingIds = new Set(TASKS_DATA.map((task) => task.id));
  const missing = IMPORTED_COMPLETED_TASKS.filter((task) => !existingIds.has(task.id));
  if (missing.length === 0) return;
  TASKS_DATA = [...missing, ...TASKS_DATA];
  saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
};

mergeImportedCompletedTasks();

const persistRecord = (recordType: WorkspaceRecordType, data: unknown[]) => {
  saveToStorage(STORAGE_KEYS[recordType], data);
  if (!cloudInitialized) return;
  cloudWorkspaceService.saveRecord(recordType, data)
    .then(() => {
      cloudAvailable = true;
    })
    .catch((error) => {
      cloudAvailable = false;
      console.error('Failed to sync workspace data to Supabase', error);
    });
};

const rememberActivity = (event: UserActivityLog | null) => {
  if (!event) return;
  ACTIVITY_LOGS = [event, ...ACTIVITY_LOGS.filter((item) => item.id !== event.id)].slice(0, 200);
};

const logActivity = (draft: ActivityDraft) => {
  if (!cloudInitialized) return;
  cloudWorkspaceService.logActivity(draft)
    .then((event) => {
      cloudAvailable = true;
      rememberActivity(event);
    })
    .catch((error) => {
      cloudAvailable = false;
      console.error('Failed to log user activity to Supabase', error);
    });
};

function notifyTaskAssignment(previous: Task | undefined, next: Task) {
  const recipientName = getTaskAssignmentRecipient(previous, next);
  if (!recipientName) return;
  notify('New case assigned', `"${next.title}" was assigned to you.`, 'purple', '/my-dashboard?tab=assigned', {
    recipientName,
    sound: true,
  });
}

function notifyHandoverAssignments(previous: Handover | undefined, next: Handover) {
  getNewHandoverRecipients(previous, next).forEach((recipientName) => {
    notify('New handover assigned', `${next.team} handover is waiting for your review.`, 'purple', '/my-dashboard?tab=handovers', {
      recipientName,
      sound: true,
    });
  });
}

const replaceWorkspaceFromCloud = (workspace: Partial<{
  campaigns: Campaign[];
  influencers: CampaignInfluencer[];
  blockers: Blocker[];
  tasks: Task[];
  handovers: Handover[];
}>) => {
  if (workspace.campaigns) {
    CAMPAIGNS_DATA = normalizeCampaignIds(workspace.campaigns).normalized;
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
  }
  if (workspace.influencers) {
    INFLUENCERS_DATA = workspace.influencers;
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
  }
  if (workspace.blockers) {
    BLOCKERS_DATA = workspace.blockers;
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
  }
  if (workspace.tasks) {
    TASKS_DATA = workspace.tasks;
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
  }
  if (workspace.handovers) {
    HANDOVERS_DATA = workspace.handovers.filter((handover) => !DEMO_HANDOVER_IDS.has(handover.id) && handover.createdBy !== 'system');
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
  }
};

// Service Methods
export const dataService = {
  async initializeCloudWorkspace() {
    if (cloudInitialized && cloudAvailable) return { cloud: cloudAvailable, activityCount: ACTIVITY_LOGS.length };
    try {
      const [cloudWorkspace, activityLogs] = await Promise.all([
        cloudWorkspaceService.loadWorkspace(),
        cloudWorkspaceService.listActivity(),
      ]);
      const hasCloudData = Object.values(cloudWorkspace).some((value) => Array.isArray(value));

      if (hasCloudData) {
        replaceWorkspaceFromCloud(cloudWorkspace);
        await Promise.all((['campaigns', 'influencers', 'blockers', 'tasks', 'handovers'] as WorkspaceRecordType[])
          .filter((recordType) => !Array.isArray((cloudWorkspace as any)[recordType]))
          .map((recordType) => cloudWorkspaceService.saveRecord(recordType, {
            campaigns: CAMPAIGNS_DATA,
            influencers: INFLUENCERS_DATA,
            blockers: BLOCKERS_DATA,
            tasks: TASKS_DATA,
            handovers: HANDOVERS_DATA,
          }[recordType])));
      } else {
        await cloudWorkspaceService.saveWorkspace({
          campaigns: CAMPAIGNS_DATA,
          influencers: INFLUENCERS_DATA,
          blockers: BLOCKERS_DATA,
          tasks: TASKS_DATA,
          handovers: HANDOVERS_DATA,
        });
      }

      ACTIVITY_LOGS = activityLogs;
      cloudAvailable = true;
    } catch (error) {
      cloudAvailable = false;
      console.error('Unable to initialize Supabase workspace data. Browser cache will be used.', error);
    } finally {
      cloudInitialized = true;
    }

    return { cloud: cloudAvailable, activityCount: ACTIVITY_LOGS.length };
  },
  isCloudReady: () => cloudInitialized && cloudAvailable,
  getActivityLogs: () => [...ACTIVITY_LOGS],
  async refreshActivityLogs(limit = 200) {
    if (!cloudInitialized) return [...ACTIVITY_LOGS];
    try {
      ACTIVITY_LOGS = await cloudWorkspaceService.listActivity(limit);
      cloudAvailable = true;
    } catch (error) {
      cloudAvailable = false;
      console.error('Failed to refresh activity logs from Supabase', error);
    }
    return [...ACTIVITY_LOGS];
  },
  recordActivity: (draft: ActivityDraft) => logActivity(draft),
  getCampaigns: () => [...CAMPAIGNS_DATA],
  updateCampaign: (id: string, updates: Partial<Campaign>) => {
    const targetIndex = CAMPAIGNS_DATA.findIndex((campaign) => campaign.id === id);
    if (targetIndex === -1) return [...CAMPAIGNS_DATA];

    CAMPAIGNS_DATA = CAMPAIGNS_DATA.map((campaign, index) =>
      index === targetIndex ? { ...campaign, ...updates, updatedAt: Date.now() } : campaign
    );
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaign.updated', entityType: 'campaign', entityId: id, summary: `Updated campaign "${CAMPAIGNS_DATA.find((campaign) => campaign.id === id)?.name || id}"`, metadata: { updates } });
    return [...CAMPAIGNS_DATA];
  },
  addCampaign: (campaign: Campaign) => {
    const usedIds = new Set(CAMPAIGNS_DATA.map((item) => item.id));
    let nextId = String((campaign as any).id ?? '').trim();
    if (!nextId || usedIds.has(nextId)) {
      do {
        nextId = buildCampaignId(usedIds.size + 1);
      } while (usedIds.has(nextId));
    }

    CAMPAIGNS_DATA = [{ ...campaign, id: nextId, createdAt: Date.now(), updatedAt: Date.now() }, ...CAMPAIGNS_DATA];
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaign.created', entityType: 'campaign', entityId: nextId, summary: `Created campaign "${campaign.name || nextId}"`, metadata: { campaignId: nextId } });
    return [...CAMPAIGNS_DATA];
  },
  upsertCampaigns: (incoming: Campaign[]) => {
    const byId = new Map(CAMPAIGNS_DATA.map(c => [c.id, c]));
    let inserted = 0;
    let updated = 0;
    incoming.forEach(item => {
      if (item.id && byId.has(item.id)) {
        byId.set(item.id, { ...byId.get(item.id)!, ...item, updatedAt: Date.now() });
        updated++;
      } else {
        const id = item.id || buildCampaignId(byId.size + 1);
        byId.set(id, { ...item, id, createdAt: Date.now(), updatedAt: Date.now() });
        inserted++;
      }
    });
    CAMPAIGNS_DATA = Array.from(byId.values());
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaigns.imported', entityType: 'campaign', summary: `Imported campaigns: ${inserted} added, ${updated} updated`, metadata: { inserted, updated } });
    return { campaigns: [...CAMPAIGNS_DATA], inserted, updated };
  },
  upsertInfluencers: (incoming: CampaignInfluencer[]) => {
    const byId = new Map(INFLUENCERS_DATA.map(i => [i.id, i]));
    let inserted = 0;
    let updated = 0;
    incoming.forEach(item => {
      if (item.id && byId.has(item.id)) {
        byId.set(item.id, { ...byId.get(item.id)!, ...item, updatedAt: Date.now() });
        updated++;
      } else {
        byId.set(item.id, { ...item, createdAt: Date.now(), updatedAt: Date.now() });
        inserted++;
      }
    });
    INFLUENCERS_DATA = Array.from(byId.values());
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencers.imported', entityType: 'influencer', summary: `Imported influencers: ${inserted} added, ${updated} updated`, metadata: { inserted, updated } });
    return { influencers: [...INFLUENCERS_DATA], inserted, updated };
  },
  upsertTasks: (incoming: Task[]) => {
    const byId = new Map(TASKS_DATA.map(t => [t.id, t]));
    let inserted = 0;
    let updated = 0;
    incoming.forEach(item => {
      if (item.id && byId.has(item.id)) {
        byId.set(item.id, { ...byId.get(item.id)!, ...item, updatedAt: Date.now() });
        updated++;
      } else {
        byId.set(item.id, { ...item, createdAt: Date.now(), updatedAt: Date.now() });
        inserted++;
      }
    });
    TASKS_DATA = Array.from(byId.values());
    persistRecord('tasks', TASKS_DATA);
    logActivity({ action: 'tasks.imported', entityType: 'task', summary: `Imported tasks: ${inserted} added, ${updated} updated`, metadata: { inserted, updated } });
    return { tasks: [...TASKS_DATA], inserted, updated };
  },
  addCampaigns: (campaigns: Campaign[]) => {
    const usedIds = new Set(CAMPAIGNS_DATA.map((item) => item.id));
    const safeCampaigns = campaigns.map((campaign, index) => {
      let nextId = String((campaign as any).id ?? '').trim();
      if (!nextId || usedIds.has(nextId)) {
        do {
          nextId = buildCampaignId(index + 1);
        } while (usedIds.has(nextId));
      }
      usedIds.add(nextId);
      return { ...campaign, id: nextId };
    });

    CAMPAIGNS_DATA = [...safeCampaigns, ...CAMPAIGNS_DATA];
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaigns.created', entityType: 'campaign', summary: `Added ${safeCampaigns.length} campaigns`, metadata: { count: safeCampaigns.length } });
    return [...CAMPAIGNS_DATA];
  },
  getTasks: () => [...TASKS_DATA],
  ensureDailyOperatingTasks: (now = Date.now()) => {
    const result = ensureDailyOperatingTasks(TASKS_DATA, now);
    if (result.createdCount > 0) {
      TASKS_DATA = result.tasks;
      persistRecord('tasks', TASKS_DATA);
      logActivity({ action: 'tasks.auto_created', entityType: 'task', summary: `Created ${result.createdCount} daily operating tasks`, metadata: { count: result.createdCount } });
    }
    return { tasks: [...TASKS_DATA], createdCount: result.createdCount };
  },
  updateTask: (id: string, updates: Partial<Task>) => {
    const previousTask = TASKS_DATA.find((task) => task.id === id);
    TASKS_DATA = TASKS_DATA.map(t => {
      if (t.id !== id) return t;
      const { createdBy: _createdBy, createdAt: _createdAt, ...safeUpdates } = updates;
      return { ...t, ...safeUpdates, createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: Date.now() };
    });
    persistRecord('tasks', TASKS_DATA);
    const updatedTask = TASKS_DATA.find((task) => task.id === id);
    logActivity({ action: 'task.updated', entityType: 'task', entityId: id, summary: `Updated task "${updatedTask?.title || id}"`, metadata: { updates } });
    if (updatedTask) notifyTaskAssignment(previousTask, updatedTask);
    return [...TASKS_DATA];
  },
  addTask: (task: Task) => {
    TASKS_DATA = [task, ...TASKS_DATA];
    persistRecord('tasks', TASKS_DATA);
    logActivity({ action: 'task.created', entityType: 'task', entityId: task.id, summary: `Created task "${task.title || task.id}"`, metadata: { campaignId: task.campaignId, ownerId: task.ownerId } });
    notifyTaskAssignment(undefined, task);
    return [...TASKS_DATA];
  },
  getHandovers: () => [...HANDOVERS_DATA],
  updateHandover: (id: string, updates: Partial<Handover>) => {
    const previousHandover = HANDOVERS_DATA.find((handover) => handover.id === id);
    HANDOVERS_DATA = HANDOVERS_DATA.map((handover) =>
      handover.id === id
        ? (() => {
          const { createdBy: _createdBy, createdAt: _createdAt, ...safeUpdates } = updates;
          return { ...handover, ...safeUpdates, createdBy: handover.createdBy, createdAt: handover.createdAt, updatedAt: Date.now() };
        })()
        : handover
    );
    persistRecord('handovers', HANDOVERS_DATA);
    const updatedHandover = HANDOVERS_DATA.find((handover) => handover.id === id);
    logActivity({ action: 'handover.updated', entityType: 'handover', entityId: id, summary: `Updated ${updatedHandover?.team || 'handover'} relay`, metadata: { updates } });
    if (updatedHandover) notifyHandoverAssignments(previousHandover, updatedHandover);
    return [...HANDOVERS_DATA];
  },
  addHandover: (handover: Handover) => {
    HANDOVERS_DATA = [handover, ...HANDOVERS_DATA];
    persistRecord('handovers', HANDOVERS_DATA);
    logActivity({ action: 'handover.created', entityType: 'handover', entityId: handover.id, summary: `Created ${handover.team} handover`, metadata: { assignTo: handover.assignTo, assignFrom: handover.assignFrom } });
    notifyHandoverAssignments(undefined, handover);
    return [...HANDOVERS_DATA];
  },
  deleteHandover: (id: string) => {
    HANDOVERS_DATA = HANDOVERS_DATA.filter((handover) => handover.id !== id);
    persistRecord('handovers', HANDOVERS_DATA);
    logActivity({ action: 'handover.deleted', entityType: 'handover', entityId: id, summary: `Deleted handover ${id}`, metadata: { id } });
    return [...HANDOVERS_DATA];
  },
  clearTasks: () => {
    TASKS_DATA = [];
    persistRecord('tasks', TASKS_DATA);
    logActivity({ action: 'tasks.cleared', entityType: 'task', summary: 'Cleared all tasks', metadata: {} });
    return [...TASKS_DATA];
  },
  getBlockers: () => [...BLOCKERS_DATA],
  updateBlocker: (id: string, updates: Partial<Blocker>) => {
    BLOCKERS_DATA = BLOCKERS_DATA.map(blocker => blocker.id === id ? { ...blocker, ...updates, updatedAt: Date.now() } : blocker);
    persistRecord('blockers', BLOCKERS_DATA);
    logActivity({ action: 'blocker.updated', entityType: 'blocker', entityId: id, summary: `Updated blocker "${BLOCKERS_DATA.find((blocker) => blocker.id === id)?.summary || id}"`, metadata: { updates } });
    return [...BLOCKERS_DATA];
  },
  addBlocker: (blocker: Blocker) => {
    BLOCKERS_DATA = [blocker, ...BLOCKERS_DATA];
    persistRecord('blockers', BLOCKERS_DATA);
    logActivity({ action: 'blocker.created', entityType: 'blocker', entityId: blocker.id, summary: `Created blocker "${blocker.summary || blocker.id}"`, metadata: { campaignId: blocker.campaignId, ownerId: blocker.ownerId } });
    return [...BLOCKERS_DATA];
  },
  clearBlockers: () => {
    BLOCKERS_DATA = [];
    persistRecord('blockers', BLOCKERS_DATA);
    logActivity({ action: 'blockers.cleared', entityType: 'blocker', summary: 'Cleared all blockers', metadata: {} });
    return [...BLOCKERS_DATA];
  },
  getInfluencers: () => [...INFLUENCERS_DATA],
  updateInfluencer: (id: string, updates: Partial<CampaignInfluencer>) => {
    INFLUENCERS_DATA = INFLUENCERS_DATA.map(inf => inf.id === id ? { ...inf, ...updates, updatedAt: Date.now() } : inf);
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencer.updated', entityType: 'influencer', entityId: id, summary: `Updated influencer "${INFLUENCERS_DATA.find((influencer) => influencer.id === id)?.username || id}"`, metadata: { updates } });
    return [...INFLUENCERS_DATA];
  },
  addInfluencers: (influencers: CampaignInfluencer[]) => {
    INFLUENCERS_DATA = [...influencers, ...INFLUENCERS_DATA];
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencers.created', entityType: 'influencer', summary: `Added ${influencers.length} influencers`, metadata: { count: influencers.length } });
    return [...INFLUENCERS_DATA];
  },
  clearInfluencers: () => {
    INFLUENCERS_DATA = [];
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencers.cleared', entityType: 'influencer', summary: 'Cleared all influencers', metadata: {} });
    return [...INFLUENCERS_DATA];
  },
  clearCampaigns: () => {
    CAMPAIGNS_DATA = [];
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaigns.cleared', entityType: 'campaign', summary: 'Cleared all campaigns', metadata: {} });
    return [...CAMPAIGNS_DATA];
  },
  clearWorkspaceData: () => {
    CAMPAIGNS_DATA = [];
    INFLUENCERS_DATA = [];
    BLOCKERS_DATA = [];
    TASKS_DATA = [];
    HANDOVERS_DATA = [];
    persistRecord('campaigns', CAMPAIGNS_DATA);
    persistRecord('influencers', INFLUENCERS_DATA);
    persistRecord('blockers', BLOCKERS_DATA);
    persistRecord('tasks', TASKS_DATA);
    persistRecord('handovers', HANDOVERS_DATA);
    logActivity({ action: 'workspace.cleared', entityType: 'workspace', summary: 'Cleared workspace data', metadata: {} });
    return {
      campaigns: [...CAMPAIGNS_DATA],
      influencers: [...INFLUENCERS_DATA],
      blockers: [...BLOCKERS_DATA],
      tasks: [...TASKS_DATA],
      handovers: [...HANDOVERS_DATA],
    };
  },
  bulkUpdateInfluencerStatus: (ids: string[], status: CampaignInfluencer['status']) => {
    INFLUENCERS_DATA = INFLUENCERS_DATA.map(inf => ids.includes(inf.id) ? { ...inf, status, updatedAt: Date.now() } : inf);
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencers.updated', entityType: 'influencer', summary: `Updated ${ids.length} influencer statuses`, metadata: { ids, status } });
    return [...INFLUENCERS_DATA];
  },
  deleteCampaign: (id: string) => {
    CAMPAIGNS_DATA = CAMPAIGNS_DATA.filter(c => c.id !== id);
    persistRecord('campaigns', CAMPAIGNS_DATA);
    logActivity({ action: 'campaign.deleted', entityType: 'campaign', entityId: id, summary: `Deleted campaign ${id}`, metadata: { id } });
    return [...CAMPAIGNS_DATA];
  },
  deleteTask: (id: string) => {
    TASKS_DATA = TASKS_DATA.filter(t => t.id !== id);
    persistRecord('tasks', TASKS_DATA);
    logActivity({ action: 'task.deleted', entityType: 'task', entityId: id, summary: `Deleted task ${id}`, metadata: { id } });
    return [...TASKS_DATA];
  },
  deleteBlocker: (id: string) => {
    BLOCKERS_DATA = BLOCKERS_DATA.filter(b => b.id !== id);
    persistRecord('blockers', BLOCKERS_DATA);
    logActivity({ action: 'blocker.deleted', entityType: 'blocker', entityId: id, summary: `Deleted blocker ${id}`, metadata: { id } });
    return [...BLOCKERS_DATA];
  },
  deleteInfluencer: (id: string) => {
    INFLUENCERS_DATA = INFLUENCERS_DATA.filter(i => i.id !== id);
    persistRecord('influencers', INFLUENCERS_DATA);
    logActivity({ action: 'influencer.deleted', entityType: 'influencer', entityId: id, summary: `Deleted influencer ${id}`, metadata: { id } });
    return [...INFLUENCERS_DATA];
  },
};

export function exportAllData() {
  return {
    campaigns: [...CAMPAIGNS_DATA],
    influencers: [...INFLUENCERS_DATA],
    blockers: [...BLOCKERS_DATA],
    tasks: [...TASKS_DATA],
    handovers: [...HANDOVERS_DATA],
    exportedAt: Date.now(),
    version: '1.0',
  };
}

export function importAllData(data: {
  campaigns?: Campaign[];
  influencers?: CampaignInfluencer[];
  blockers?: Blocker[];
  tasks?: Task[];
  handovers?: Handover[];
}) {
  if (Array.isArray(data.campaigns)) {
    CAMPAIGNS_DATA = data.campaigns;
    persistRecord('campaigns', CAMPAIGNS_DATA);
  }
  if (Array.isArray(data.influencers)) {
    INFLUENCERS_DATA = data.influencers;
    persistRecord('influencers', INFLUENCERS_DATA);
  }
  if (Array.isArray(data.blockers)) {
    BLOCKERS_DATA = data.blockers;
    persistRecord('blockers', BLOCKERS_DATA);
  }
  if (Array.isArray(data.tasks)) {
    TASKS_DATA = data.tasks;
    persistRecord('tasks', TASKS_DATA);
  }
  if (Array.isArray(data.handovers)) {
    HANDOVERS_DATA = data.handovers;
    persistRecord('handovers', HANDOVERS_DATA);
  }
  logActivity({ action: 'workspace.imported', entityType: 'workspace', summary: 'Imported workspace backup data', metadata: {
    campaigns: data.campaigns?.length,
    influencers: data.influencers?.length,
    blockers: data.blockers?.length,
    tasks: data.tasks?.length,
    handovers: data.handovers?.length,
  } });
}

export function downloadJson(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
