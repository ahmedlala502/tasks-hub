/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

// Seeded from backup trygc-backup-1778656311825.json
const INITIAL_CAMPAIGNS_DATA: Campaign[] = [
  {
    id: 'C-001', name: 'Red Bull Summer KSA', clientId: 'c1', brandId: 'b1',
    stage: 14 as any, status: 'Active', country: 'KSA', budget: 50000, budgetType: 'USD',
    recordHealth: 'Healthy', targetInfluencers: 50, targetPostingCoverage: 100,
    currentOwner: 'Sarah A.', nextAction: 'Reconcile visit logs',
    createdAt: 1778223025420, updatedAt: 1778655025420, createdBy: 'system',
    city: 'Riyadh', objective: 'Brand Awareness', platforms: ['Instagram', 'TikTok'],
    type: 'Influencer Marketing', startDate: '2024-06-01', endDate: '2024-08-31',
    deliverables: '2 Stories, 1 Reel', tags: '#RedBullSummer', mentions: '@redbullksa',
    links: 'redbull.com/summer', visitRequired: true, productDetails: 'Summer Edition Cans',
    approvalFlow: 'Standard', reportingCadence: 'Weekly', restrictions: 'None',
    internalOwners: ['Sarah A.'], clientOwners: ['John D.'],
    influencerCriteria: 'Gen Z, Outdoor lifestyle',
  },
  {
    id: 'C-002', name: 'STC Pay Launch', clientId: 'c2', brandId: 'b2',
    stage: 6 as any, status: 'Active', country: 'UAE', budget: 120000, budgetType: 'USD',
    recordHealth: 'Healthy', targetInfluencers: 200, targetPostingCoverage: 400,
    currentOwner: 'Ahmed E.', nextAction: 'Finalize influencer selection',
    createdAt: 1778482225420, updatedAt: 1778655025420, createdBy: 'system',
    city: 'Dubai', objective: 'User Acquisition', platforms: ['Snapchat', 'TikTok'],
    type: 'Performance', startDate: '2024-07-01', endDate: '2024-07-15',
    deliverables: '1 Snap Ad, 1 TikTok Spark', tags: '#STCPayUAE', mentions: '@stcpay_uae',
    links: 'stcpay.com.ae/launch', visitRequired: false, productDetails: 'Mobile App',
    approvalFlow: 'High Priority', reportingCadence: 'Daily', restrictions: 'No competitors',
    internalOwners: ['Ahmed E.'], clientOwners: ['Sarah M.'],
    influencerCriteria: 'Tech savvy, UAE based',
  },
];

const INITIAL_INFLUENCERS_DATA: CampaignInfluencer[] = [
  {
    id: 'CI-001', campaignId: 'C-001', influencerId: 'INF-101', username: '@lifestyle_sa',
    platform: 'Instagram', status: 'Confirmed', niche: 'Lifestyle', followerRange: '100k-500k',
    invitationWave: 1, reminder1Sent: true, reminder2Sent: false, visitCompleted: true,
    coverageReceived: true, qaStatus: 'Approved', ownerId: 'Sarah A.',
    createdAt: 1778655025420, updatedAt: 1778655025420, createdBy: 'system',
  },
  {
    id: 'CI-002', campaignId: 'C-001', influencerId: 'INF-102', username: '@travel_vibe',
    platform: 'TikTok', status: 'Pending', niche: 'Travel', followerRange: '50k-100k',
    invitationWave: 1, reminder1Sent: false, reminder2Sent: false, visitCompleted: false,
    coverageReceived: false, qaStatus: 'Pending', ownerId: 'Sarah A.', city: 'Dubai',
    createdAt: 1778655025420, updatedAt: 1778655025420, createdBy: 'system',
  },
  {
    id: 'CI-003', campaignId: 'C-002', influencerId: 'INF-103', username: '@tech_guy_uae',
    platform: 'Snapchat', status: 'Invited', niche: 'Tech', followerRange: '10k-50k',
    invitationWave: 2, reminder1Sent: true, reminder2Sent: true, visitCompleted: false,
    coverageReceived: false, qaStatus: 'Pending', ownerId: 'Ahmed E.', city: 'Abu Dhabi',
    createdAt: 1778655025420, updatedAt: 1778655025420, createdBy: 'system',
  },
  {
    id: 'CI-004', campaignId: 'C-001', influencerId: 'INF-104', username: '@foodie_riyadh',
    platform: 'Instagram', status: 'Confirmed', niche: 'Food', followerRange: '500k-1M',
    invitationWave: 1, reminder1Sent: true, reminder2Sent: false, visitCompleted: true,
    coverageReceived: false, qaStatus: 'Pending', ownerId: 'Sarah A.', city: 'Riyadh',
    createdAt: 1778655025420, updatedAt: 1778655025420, createdBy: 'system',
  },
];

const INITIAL_BLOCKERS_DATA: Blocker[] = [
  {
    id: 'B-001', campaignId: 'C-001', summary: 'Visit Proof Mismatch for @lifestyle_sa',
    impact: 'QA blocking for 12 posts', status: 'Open', severity: 'Critical',
    ownerId: 'Sarah A.', createdAt: 1778655025420, updatedAt: 1778655025420, createdBy: 'system',
  },
];

// Real team roles used as default owner options across the workspace
const IMPORTED_COMPLETED_TASK_ROWS = parseCompletedTasksCsv(completedTasksCsv);
export const IMPORTED_COMPLETED_TASKS = buildImportedCompletedTasks(IMPORTED_COMPLETED_TASK_ROWS);
export const IMPORTED_COMPLETED_USER_NAMES = deriveUsersFromCompletedTasks(IMPORTED_COMPLETED_TASK_ROWS);
export const ATTACHED_EXPORT_USERS = extractUsersFromWorkspaceExport(attachedWorkspaceExport);

export const TEAM_MEMBERS: string[] = [
  'Campaign Manager',
  'Community Lead',
  'Coordination Lead',
  'Coverage Lead',
  'QA Lead',
  'Finance Lead',
  'Head of Operations',
  ...DEFAULT_ACCESS_USERS.map((user) => user.name),
  ...IMPORTED_COMPLETED_USER_NAMES,
];

const INITIAL_TASKS_DATA: Task[] = IMPORTED_COMPLETED_TASKS;

const INITIAL_HANDOVERS_DATA: Handover[] = [];

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

// V4 — tasks cleared (users start fresh with no bulk/demo tasks)
const STORAGE_KEYS = {
  campaigns: 'GC_CAMPAIGNS_V3',
  influencers: 'GC_INFLUENCERS_V3',
  blockers: 'GC_BLOCKERS_V3',
  tasks: 'GC_TASKS_V4',
  handovers: 'GC_HANDOVERS_V3',
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
