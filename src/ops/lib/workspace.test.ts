import { describe, expect, it } from 'vitest';
import { CampaignStage } from '../constants';
import type { Campaign, Handover, Task } from '../types';
import {
  canEditHandoverRecord,
  canEditTaskRecord,
  filterCampaignsByRole,
  filterHandoversByRole,
  filterTasksByRole,
} from './workspace';

const now = new Date('2026-05-17T10:00:00Z').getTime();

function task(overrides: Partial<Task>): Task {
  return {
    id: 'T-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'Ahmed Elmahdi',
    title: 'Task',
    description: '',
    ownerId: 'Mona K.',
    dueDate: now,
    campaignId: 'Operations Launch',
    priority: 'Medium',
    completed: false,
    ...overrides,
  };
}

function campaign(overrides: Partial<Campaign>): Campaign {
  return {
    id: 'C-1',
    createdAt: now,
    updatedAt: now,
    createdBy: 'Ahmed Elmahdi',
    name: 'Launch',
    clientId: '',
    brandId: '',
    country: '',
    city: '',
    objective: '',
    platforms: [],
    type: '',
    budget: 0,
    budgetType: '',
    targetInfluencers: 0,
    targetPostingCoverage: 0,
    startDate: '',
    endDate: '',
    deliverables: '',
    tags: '',
    mentions: '',
    links: '',
    visitRequired: false,
    productDetails: '',
    approvalFlow: '',
    reportingCadence: '',
    restrictions: '',
    internalOwners: [],
    clientOwners: [],
    influencerCriteria: '',
    currentOwner: '',
    nextAction: '',
    stage: CampaignStage.INTAKE,
    status: 'Active',
    recordHealth: 'Healthy',
    ...overrides,
  };
}

function handover(overrides: Partial<Handover>): Handover {
  return {
    id: 'H-1',
    handoffDate: '2026-05-17',
    fromShift: 'Morning',
    toShift: 'Mid',
    team: 'Operations',
    region: 'Regional',
    outgoingLead: 'Ahmed Elmahdi',
    incomingLead: 'Mona K.',
    assignFrom: ['Ahmed Elmahdi'],
    assignTo: ['Mona K.'],
    notes: '',
    taskIds: [],
    status: 'Pending',
    createdAt: now,
    updatedAt: now,
    createdBy: 'Ahmed Elmahdi',
    ...overrides,
  };
}

describe('workspace visibility and edit ownership', () => {
  it('shows all tasks, campaigns, and handovers to every signed-in role', () => {
    const mixedTasks = [
      task({ id: 'T-OPS', title: 'Operations task', ownerId: 'Ahmed Elmahdi' }),
      task({ id: 'T-COM', title: 'Community task', ownerId: 'Mona K.' }),
    ];
    const mixedCampaigns = [
      campaign({ id: 'C-OPS', name: 'Operations campaign', currentOwner: 'Ahmed Elmahdi' }),
      campaign({ id: 'C-COM', name: 'Community campaign', currentOwner: 'Mona K.' }),
    ];
    const mixedHandovers = [
      handover({ id: 'H-OPS', team: 'Operations' }),
      handover({ id: 'H-COM', team: 'Community' }),
    ];

    for (const role of ['master', 'operations', 'community'] as const) {
      expect(filterTasksByRole(role, mixedTasks).map(item => item.id)).toEqual(['T-OPS', 'T-COM']);
      expect(filterCampaignsByRole(role, mixedCampaigns).map(item => item.id)).toEqual(['C-OPS', 'C-COM']);
      expect(filterHandoversByRole(role, mixedHandovers).map(item => item.id)).toEqual(['H-OPS', 'H-COM']);
    }
  });

  it('allows only master or the assigned task owner to edit a task', () => {
    const record = task({ ownerId: 'Mona K.', createdBy: 'Ahmed Elmahdi' });

    expect(canEditTaskRecord('master', 'Anyone', record)).toBe(true);
    expect(canEditTaskRecord('operations', 'Mona K.', record)).toBe(true);
    expect(canEditTaskRecord('community', 'Ahmed Elmahdi', record)).toBe(false);
  });

  it('allows only master or handover participants to edit a handover', () => {
    const record = handover({ assignFrom: ['Ahmed Elmahdi'], assignTo: ['Mona K.'] });

    expect(canEditHandoverRecord('master', 'Anyone', record)).toBe(true);
    expect(canEditHandoverRecord('operations', 'Mona K.', record)).toBe(true);
    expect(canEditHandoverRecord('community', 'Sarah A.', record)).toBe(false);
  });
});
