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
import { buildImportedCompletedTasks, deriveUsersFromCompletedTasks, extractUsersFromWorkspaceExport, parseCompletedTasksCsv } from '../lib/importedWorkspaceData';
import { DEFAULT_ACCESS_USERS } from '../auth/defaultAccessUsers';

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

const INITIAL_CAMPAIGNS_DATA: Campaign[] = [];

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

// V5 — tasks and handovers reset for demo
const STORAGE_KEYS = {
  campaigns: 'GC_CAMPAIGNS_V4',
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

// Service Methods
export const dataService = {
  getCampaigns: () => [...CAMPAIGNS_DATA],
  updateCampaign: (id: string, updates: Partial<Campaign>) => {
    const targetIndex = CAMPAIGNS_DATA.findIndex((campaign) => campaign.id === id);
    if (targetIndex === -1) return [...CAMPAIGNS_DATA];

    CAMPAIGNS_DATA = CAMPAIGNS_DATA.map((campaign, index) =>
      index === targetIndex ? { ...campaign, ...updates, updatedAt: Date.now() } : campaign
    );
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
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
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
    return [...CAMPAIGNS_DATA];
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
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
    return [...CAMPAIGNS_DATA];
  },
  getTasks: () => [...TASKS_DATA],
  ensureDailyOperatingTasks: (now = Date.now()) => {
    const result = ensureDailyOperatingTasks(TASKS_DATA, now);
    if (result.createdCount > 0) {
      TASKS_DATA = result.tasks;
      saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    }
    return { tasks: [...TASKS_DATA], createdCount: result.createdCount };
  },
  updateTask: (id: string, updates: Partial<Task>) => {
    TASKS_DATA = TASKS_DATA.map(t => t.id === id ? { ...t, ...updates } : t);
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    return [...TASKS_DATA];
  },
  addTask: (task: Task) => {
    TASKS_DATA = [task, ...TASKS_DATA];
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    return [...TASKS_DATA];
  },
  getHandovers: () => [...HANDOVERS_DATA],
  updateHandover: (id: string, updates: Partial<Handover>) => {
    HANDOVERS_DATA = HANDOVERS_DATA.map((handover) =>
      handover.id === id ? { ...handover, ...updates, updatedAt: Date.now() } : handover
    );
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
    return [...HANDOVERS_DATA];
  },
  addHandover: (handover: Handover) => {
    HANDOVERS_DATA = [handover, ...HANDOVERS_DATA];
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
    return [...HANDOVERS_DATA];
  },
  deleteHandover: (id: string) => {
    HANDOVERS_DATA = HANDOVERS_DATA.filter((handover) => handover.id !== id);
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
    return [...HANDOVERS_DATA];
  },
  clearTasks: () => {
    TASKS_DATA = [];
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    return [...TASKS_DATA];
  },
  getBlockers: () => [...BLOCKERS_DATA],
  updateBlocker: (id: string, updates: Partial<Blocker>) => {
    BLOCKERS_DATA = BLOCKERS_DATA.map(blocker => blocker.id === id ? { ...blocker, ...updates, updatedAt: Date.now() } : blocker);
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
    return [...BLOCKERS_DATA];
  },
  addBlocker: (blocker: Blocker) => {
    BLOCKERS_DATA = [blocker, ...BLOCKERS_DATA];
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
    return [...BLOCKERS_DATA];
  },
  clearBlockers: () => {
    BLOCKERS_DATA = [];
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
    return [...BLOCKERS_DATA];
  },
  getInfluencers: () => [...INFLUENCERS_DATA],
  updateInfluencer: (id: string, updates: Partial<CampaignInfluencer>) => {
    INFLUENCERS_DATA = INFLUENCERS_DATA.map(inf => inf.id === id ? { ...inf, ...updates, updatedAt: Date.now() } : inf);
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
    return [...INFLUENCERS_DATA];
  },
  addInfluencers: (influencers: CampaignInfluencer[]) => {
    INFLUENCERS_DATA = [...influencers, ...INFLUENCERS_DATA];
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
    return [...INFLUENCERS_DATA];
  },
  clearInfluencers: () => {
    INFLUENCERS_DATA = [];
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
    return [...INFLUENCERS_DATA];
  },
  clearCampaigns: () => {
    CAMPAIGNS_DATA = [];
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
    return [...CAMPAIGNS_DATA];
  },
  clearWorkspaceData: () => {
    CAMPAIGNS_DATA = [];
    INFLUENCERS_DATA = [];
    BLOCKERS_DATA = [];
    TASKS_DATA = [];
    HANDOVERS_DATA = [];
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
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
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
    return [...INFLUENCERS_DATA];
  },
  deleteCampaign: (id: string) => {
    CAMPAIGNS_DATA = CAMPAIGNS_DATA.filter(c => c.id !== id);
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
    return [...CAMPAIGNS_DATA];
  },
  deleteTask: (id: string) => {
    TASKS_DATA = TASKS_DATA.filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
    return [...TASKS_DATA];
  },
  deleteBlocker: (id: string) => {
    BLOCKERS_DATA = BLOCKERS_DATA.filter(b => b.id !== id);
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
    return [...BLOCKERS_DATA];
  },
  deleteInfluencer: (id: string) => {
    INFLUENCERS_DATA = INFLUENCERS_DATA.filter(i => i.id !== id);
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
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
    saveToStorage(STORAGE_KEYS.campaigns, CAMPAIGNS_DATA);
  }
  if (Array.isArray(data.influencers)) {
    INFLUENCERS_DATA = data.influencers;
    saveToStorage(STORAGE_KEYS.influencers, INFLUENCERS_DATA);
  }
  if (Array.isArray(data.blockers)) {
    BLOCKERS_DATA = data.blockers;
    saveToStorage(STORAGE_KEYS.blockers, BLOCKERS_DATA);
  }
  if (Array.isArray(data.tasks)) {
    TASKS_DATA = data.tasks;
    saveToStorage(STORAGE_KEYS.tasks, TASKS_DATA);
  }
  if (Array.isArray(data.handovers)) {
    HANDOVERS_DATA = data.handovers;
    saveToStorage(STORAGE_KEYS.handovers, HANDOVERS_DATA);
  }
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
